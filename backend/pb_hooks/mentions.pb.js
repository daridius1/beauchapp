/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((e) => {
    try {
        const post = e.record;
        const content = post.getString("content");
        const authorId = post.getString("author");

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

        if (mentionedUsernames.size === 0) {
            return;
        }

        const author = $app.findRecordById("users", authorId);
        const authorUsername = author.getString("username") || "alguien";

        const notifCollection = $app.findCollectionByNameOrId("notifications");

        mentionedUsernames.forEach((username) => {
            try {
                // Find user by username
                const targetUser = $app.findFirstRecordByFilter("users", "username = {:username}", { username: username });
                if (targetUser && targetUser.id !== authorId) {
                    // Create notification
                    const notif = new Record(notifCollection);
                    notif.set("user", targetUser.id);
                    notif.set("sender", authorId);
                    notif.set("type", "mention");
                    notif.set("title", "Te mencionaron 🏷️");
                    notif.set("body", "@" + authorUsername + " te ha mencionado en una publicación.");
                    notif.set("read", false);
                    notif.set("relatedId", post.id);
                    $app.save(notif);
                    console.log("[Mentions] Notification created for " + username + " (ID: " + targetUser.id + ") in post " + post.id);
                }
            } catch (userErr) {
                // User not found or query error, ignore and continue
            }
        });
    } catch (err) {
        console.log("[Mentions] Error processing mentions:", err.message || err);
    }
}, "posts");
