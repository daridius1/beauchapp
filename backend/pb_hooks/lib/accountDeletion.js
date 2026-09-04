// Lógica pura de "eliminar cuenta" — sin $app ni $security, para poder testearse con
// node --test. Lo que sí toca $app/$security (buscar el registro, hashear el correo,
// rotar tokenKey, guardar) vive en account_deletion.pb.js y en auth.pb.js, adentro de
// cada handler (ver CLAUDE.md §2.1: cada routerAdd corre en su propia VM).

const COOLDOWN_DAYS = 7;

// Texto que reemplaza el nombre real en toda cuenta eliminada. Genérico para los dos
// tipos de cuenta (estudiante u organización/equipo/liga/etc.) — no hay necesidad de
// distinguir, ya que el resto de los campos identificables también se vacían.
const ANONYMIZED_NAME = "Cuenta eliminada";

// Cuántos días de cooldown quedan antes de poder volver a registrarse con el mismo
// correo. 0 si ya pasaron los 7 días (o si deletedAtIso es inválido/vacío).
function cooldownDaysRemaining(deletedAtIso, now) {
  if (!deletedAtIso) return 0;
  const deletedAt = new Date(deletedAtIso);
  if (isNaN(deletedAt.getTime())) return 0;

  const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = deletedAt.getTime() + cooldownMs - now.getTime();
  if (remainingMs <= 0) return 0;

  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

// Sobrescribe en el record TODOS los campos identificables de una cuenta. Recibe un
// objeto "record"-like (cualquier cosa con .set(name, value), sea el Record real de
// PocketBase o un mock de test) para no depender de $app. Deliberadamente NO toca id,
// type ni subtype: de esos depende que el resto del sistema (rosters de equipo, tabla
// de posiciones, hilos de foro) no se rompa al desaparecer la identidad de la cuenta.
function anonymizeUserRecord(record, { emailHash, deletedAtIso, usernamePlaceholder }) {
  record.set("deleted", true);
  record.set("deletedAt", deletedAtIso);
  record.set("deletedEmailHash", emailHash || "");

  record.set("email", "");
  record.set("emailVisibility", false);
  record.set("username", usernamePlaceholder);
  record.set("name", ANONYMIZED_NAME);
  record.set("avatar", "");
  record.set("matchPhoto", "");
  record.set("matchAlias", "");
  record.set("description", "");
  record.set("chip_text", "");
  record.set("chip_color", "");
  record.set("entry_year", "");
  record.set("department", "");
  record.set("instagram", "");
  record.set("telegram", "");
  record.set("whatsapp", "");
  record.set("signal", "");
  record.set("website", "");
  record.set("newsInstructions", "");
  record.set("registrationToken", "");
  record.set("tokenExpiresAt", "");
  record.set("last_seen_announcement", "");
}

module.exports = {
  COOLDOWN_DAYS,
  ANONYMIZED_NAME,
  cooldownDaysRemaining,
  anonymizeUserRecord,
};
