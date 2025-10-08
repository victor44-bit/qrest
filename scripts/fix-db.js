/**
 * scripts/fix-db.js
 * Uses Prisma with Mongo to unset authorId when it's null (P2032 fix).
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    // Unset authorId when value is explicitly null
    const res = await prisma.$runCommandRaw({
      update: "Chain",
      updates: [
        {
          q: { authorId: null },
          u: { $unset: { authorId: "" } },
          multi: true,
          upsert: false,
        },
      ],
    });
    console.log("Unset authorId:null result:", res);
  } catch (err) {
    console.error("fix-db error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
