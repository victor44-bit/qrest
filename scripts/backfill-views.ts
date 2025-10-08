import { prisma } from "@/lib/prisma";

async function main() {
  const res = await prisma.chain.updateMany({
    where: { views: { equals: null as any } },
    data: { views: 0 },
  });
  console.log(`Updated ${res.count} chains with views = 0`);
}

main().finally(() => process.exit(0));
