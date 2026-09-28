/**
 * People named in the NH44 solution document, plus two portal roles
 * (platform admin and auditor) that the document does not name.
 */
export const ADMIN_ID = "usr-platform-admin";
export const AUDITOR_ID = "usr-auditor";

export const PEOPLE = {
  admin: {
    id: ADMIN_ID,
    name: "NH44 Platform Admin",
    email: "platform.admin@tkm.example",
    title: "IDP platform admin",
  },
  auditor: {
    id: AUDITOR_ID,
    name: "NH44 Auditor",
    email: "auditor@tkm.example",
    title: "Compliance auditor",
  },
  pavithra: {
    id: "usr-pavithra",
    name: "Pavithra S",
    email: "pavithra.s@tkm.example",
    title: "AIDD application owner",
  },
  rathi: {
    id: "usr-rathi",
    name: "Rathi",
    email: "rathi@tkm.example",
    title: "Connected apps owner",
  },
  sreeprabha: {
    id: "usr-sreeprabha",
    name: "Sreeprabha",
    email: "sreeprabha@tkm.example",
    title: "Connected apps owner",
  },
  rashi: {
    id: "usr-rashi",
    name: "Rashi",
    email: "rashi@tkm.example",
    title: "Connected apps owner",
  },
};
