export interface ActivityPubEntity {
  id: string | number;
  name: string;
  slug: string;
  bio?: string;
  publicKeyPem?: string;
}

export interface ActivityPubActor {
  "@context": string[];
  id: string;
  type: string;
  preferredUsername: string;
  name: string;
  summary: string;
  inbox: string;
  outbox: string;
  publicKey?: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
}

export interface WebFingerResponse {
  subject: string;
  links: Array<{
    rel: string;
    type?: string;
    href?: string;
  }>;
}

export interface ActivityPubNote {
  "@context": string;
  id: string;
  type: string;
  actor: string;
  to: string[];
  object: {
    id: string;
    type: string;
    published: string;
    attributedTo: string;
    content: string;
    to: string[];
  };
}

export function buildActor(entity: ActivityPubEntity, domain = "sailsouthern.com"): ActivityPubActor {
  const actorId = `https://${domain}/api/entities/${entity.slug}/actor`;
  const actor: ActivityPubActor = {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1"
    ],
    "id": actorId,
    "type": "Person",
    "preferredUsername": entity.slug,
    "name": entity.name,
    "summary": entity.bio ?? `Sailing Almanac entity feed for ${entity.name}`,
    "inbox": `https://${domain}/api/entities/${entity.slug}/inbox`,
    "outbox": `https://${domain}/api/entities/${entity.slug}/outbox`
  };

  if (entity.publicKeyPem) {
    actor.publicKey = {
      id: `${actorId}#main-key`,
      owner: actorId,
      publicKeyPem: entity.publicKeyPem
    };
  }

  return actor;
}

export function buildWebFinger(username: string, domain = "sailsouthern.com"): WebFingerResponse {
  return {
    subject: `acct:${username}@${domain}`,
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: `https://${domain}/api/entities/${username}/actor`
      }
    ]
  };
}

export function buildCreateNote(
  actorId: string,
  object: { id: string; content: string; published: string; to?: string[] },
  domain = "sailsouthern.com"
): ActivityPubNote {
  const to = object.to ?? ["https://www.w3.org/ns/activitystreams#Public"];
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `https://${domain}/api/activities/${object.id}`,
    "type": "Create",
    "actor": actorId,
    "to": to,
    "object": {
      "id": `https://${domain}/api/notes/${object.id}`,
      "type": "Note",
      "published": object.published,
      "attributedTo": actorId,
      "content": object.content,
      "to": to
    }
  };
}

import crypto from "crypto";

export function generateRSAKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    }
  });
  return { publicKey, privateKey };
}

export function computeDigest(body: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(body, "utf8");
  return `SHA-256=${hash.digest("base64")}`;
}

export interface SignOptions {
  privateKeyPem: string;
  keyId: string;
  method: string;
  targetPath: string;
  host: string;
  date: string;
  digest: string;
}

export function signActivityPubRequest(options: SignOptions): string {
  const signatureString = [
    `(request-target): ${options.method.toLowerCase()} ${options.targetPath}`,
    `host: ${options.host}`,
    `date: ${options.date}`,
    `digest: ${options.digest}`
  ].join("\n");

  const sign = crypto.createSign("sha256");
  sign.update(signatureString);
  const signature = sign.sign(options.privateKeyPem, "base64");

  return `keyId="${options.keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signature}"`;
}

export * from "./social-archive";
export * from "./ga4";

