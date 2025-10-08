// app/api/users/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

const J = (s: number, p: any) => NextResponse.json(p, { status: s });
const isHex24 = (s: unknown) =>
  typeof s === "string" && /^[0-9a-f]{24}$/i.test(String(s || ""));

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = requireAdmin();
  if (guard) return guard;

  const id = String(params?.id || "").trim();
  if (!isHex24(id)) return J(400, { error: "Invalid user id" });

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) return J(404, { error: "User not found" });

    // ------ 1) Find all chains authored by this user
    const chains = await prisma.chain.findMany({
      where: { authorId: id },
      select: { id: true },
    });
    const chainIds = chains.map((c) => c.id);

    // ------ 2) Delete contributions in those chains (children first, then roots)
    let deletedInChains = 0;
    if (chainIds.length) {
      // Do a few passes to handle deep trees; then a final sweep
      for (let i = 0; i < 5; i++) {
        const delChildren = await prisma.contribution.deleteMany({
          where: { chainId: { in: chainIds }, parentId: { not: null } },
        });
        deletedInChains += delChildren.count;

        const delRoots = await prisma.contribution.deleteMany({
          where: { chainId: { in: chainIds }, parentId: null },
        });
        deletedInChains += delRoots.count;

        const remain = await prisma.contribution.count({
          where: { chainId: { in: chainIds } },
        });
        if (remain === 0) break;
      }
      // Final unconditional sweep (in case of odd data without parentId)
      const finalSweep = await prisma.contribution.deleteMany({
        where: { chainId: { in: chainIds } },
      });
      deletedInChains += finalSweep.count;
    }

    // ------ 3) Delete the user's contributions in OTHER people's chains (with descendants)
    let deletedElsewhere = 0;
    // Start with all contributions authored by this user (outside their own chains if any)
    const authored = await prisma.contribution.findMany({
      where: {
        authorId: id,
        ...(chainIds.length ? { chainId: { notIn: chainIds } } : {}),
      },
      select: { id: true },
    });
    if (authored.length) {
      // Iteratively delete descendants layer-by-layer
      // We delete children first repeatedly, then finally the authored nodes.
      let frontier = authored.map((c) => c.id);
      for (let i = 0; i < 8 && frontier.length; i++) {
        const children = await prisma.contribution.findMany({
          where: { parentId: { in: frontier } },
          select: { id: true },
        });
        if (!children.length) break;
        const childIds = children.map((c) => c.id);
        const delKids = await prisma.contribution.deleteMany({
          where: { id: { in: childIds } },
        });
        deletedElsewhere += delKids.count;
        frontier = childIds;
      }
      // Delete the originally-authored nodes last
      const delAuthored = await prisma.contribution.deleteMany({
        where: {
          authorId: id,
          ...(chainIds.length ? { chainId: { notIn: chainIds } } : {}),
        },
      });
      deletedElsewhere += delAuthored.count;
    }

    // ------ 4) Delete the chains (now that nothing points to them)
    const chainDel = await prisma.chain.deleteMany({
      where: { authorId: id },
    });

    // ------ 5) Clean up tokens
    const tokenDel = await prisma.passwordResetToken.deleteMany({
      where: { userId: id },
    });

    // ------ 6) Finally delete the user
    // (No transaction here to avoid timeout; order above ensures referential safety)
    await prisma.user.delete({ where: { id } });

    return J(200, {
      ok: true,
      chainsDeleted: chainDel.count,
      contributionsDeleted: deletedInChains + deletedElsewhere,
      tokensDeleted: tokenDel.count,
      userDeleted: id,
    });
  } catch (e: any) {
    console.error("DELETE /api/users/[id] error:", e);
    return J(500, {
      error:
        process.env.NODE_ENV === "development"
          ? String(e?.message || e)
          : "Server error",
    });
  }
}
