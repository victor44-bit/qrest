const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fixModel(modelName, findAll, updateOne) {
  const all = await findAll();
  const targets = all.filter((x) => !x.createdAt);
  for (const doc of targets) {
    await updateOne(doc);
  }
  console.log(`✓ ${modelName}: fixed ${targets.length} record(s) with missing createdAt`);
}

(async () => {
  const now = new Date();

  await fixModel(
    "User",
    () => prisma.user.findMany(),
    (u) => prisma.user.update({ where: { id: u.id }, data: { createdAt: u.createdAt ?? now } })
  );

  await fixModel(
    "Chain",
    () => prisma.chain.findMany(),
    (c) => prisma.chain.update({ where: { id: c.id }, data: { createdAt: c.createdAt ?? now } })
  );

  await fixModel(
    "Contribution",
    () => prisma.contribution.findMany(),
    (k) => prisma.contribution.update({ where: { id: k.id }, data: { createdAt: k.createdAt ?? now } })
  );

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});