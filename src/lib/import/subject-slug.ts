// Subject.slug is unique and transliteration can collide (ө and о both become "o"), so
// a new subject's slug gets a numeric suffix until it is free. Shared by the import's
// commit() and the admin panel, which must agree on how a subject is named.
//
// No Prisma import: the caller passes anything that can look a slug up, so this file
// stays usable from the CLI and from Next.js alike.

import { slugify } from "../slug";

type SlugLookup = {
  subject: { findUnique: (args: { where: { slug: string } }) => Promise<unknown> };
};

/** A free slug derived from the subject's name. Never changes an existing subject. */
export async function uniqueSubjectSlug(client: SlugLookup, name: string): Promise<string> {
  const base = slugify(name) || "subject";
  let slug = base;
  let suffix = 2;
  while (await client.subject.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}
