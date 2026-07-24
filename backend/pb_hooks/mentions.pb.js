/// <reference path="../pb_data/types.d.ts" />
console.log("[LOAD] mentions.pb.js hook file has been read and loaded by PocketBase!");

onRecordAfterCreateSuccess((e) => {
    try {
        const post = e.record;
        const content = post.getString("content");
        const authorId = post.getString("author");

        console.log("[Mentions Hook] Triggered for post ID:", post.id, "content:", content, "author:", authorId);

        if (!content) {
            return;
        }

        // Regex to match mentions: @username (only preceded by start of line or space to avoid email match)
        const regex = /(?:^|\s)@([a-zA-Z0-9_-]{3,20})\b/g;
        let match;
        const mentionedUsernames = new Set();
        while ((match = regex.exec(content)) !== null) {
            mentionedUsernames.add(match[1].toLowerCase());
        }

        console.log("[Mentions Hook] Mentioned usernames parsed:", JSON.stringify(Array.from(mentionedUsernames)));

        if (mentionedUsernames.size === 0) {
            return;
        }

        const author = $app.findRecordById("users", authorId);
        const authorUsername = author.getString("username") || "alguien";

        const notifCollection = $app.findCollectionByNameOrId("notifications");

        mentionedUsernames.forEach((username) => {
            try {
                // Find user by username
                const targetUser = $app.findFirstRecordByFilter("users", `username = "${username}"`);
                console.log("[Mentions Hook] Target user search for", username, ":", targetUser ? targetUser.id : "null");
                
                if (targetUser && targetUser.id !== authorId) {
                    // Create notification
                    const notif = new Record(notifCollection);
                    notif.set("user", targetUser.id);
                    notif.set("sender", authorId);
                    notif.set("type", "mention");
                    notif.set("title", "Te mencionaron");
                    notif.set("body", "@" + authorUsername + " te ha mencionado en una publicación.");
                    notif.set("read", false);
                    notif.set("relatedId", post.id);
                    $app.save(notif);
                    console.log("[Mentions Hook] Notification created successfully for " + username + " (ID: " + targetUser.id + ") in post " + post.id);
                } else if (targetUser && targetUser.id === authorId) {
                    console.log("[Mentions Hook] Skipped notification: self-mention for", username);
                }
            } catch (userErr) {
                console.log("[Mentions Hook] Error processing mention for " + username + ":", userErr.message || userErr);
            }
        });
    } catch (err) {
        console.log("[Mentions Hook] Outer error processing mentions:", err.message || err);
    }
}, "posts");
