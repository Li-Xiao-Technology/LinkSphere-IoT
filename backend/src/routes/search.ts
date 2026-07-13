import express from 'express';
import { prisma } from '../prisma/client';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length < 1) {
      return res.json([]);
    }

    const searchTerm = query.toLowerCase().trim();

    const [devices, scenes, rules, rooms] = await Promise.all([
      prisma.device.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { type: { contains: searchTerm } },
            { brand: { contains: searchTerm } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
          brand: true,
          status: true,
        },
      }),
      prisma.scene.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { description: { contains: searchTerm } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
        },
      }),
      prisma.rule.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { triggerType: { contains: searchTerm } },
          ],
        },
        select: {
          id: true,
          name: true,
          triggerType: true,
          enabled: true,
        },
      }),
      prisma.room.findMany({
        where: {
          name: { contains: searchTerm },
        },
        select: {
          id: true,
          name: true,
          icon: true,
        },
      }),
    ]);

    const allResults: any[] = [];

    devices.forEach((d) => {
      allResults.push({
        type: 'device',
        id: d.id,
        name: d.name,
        description: `${d.brand} - ${d.type}`,
        status: d.status,
      });
    });

    scenes.forEach((s) => {
      allResults.push({
        type: 'scene',
        id: s.id,
        name: s.name,
        description: s.description || undefined,
        icon: s.icon || undefined,
      });
    });

    rules.forEach((r) => {
      allResults.push({
        type: 'rule',
        id: r.id,
        name: r.name,
        description: r.triggerType,
        status: r.enabled ? 'enabled' : 'disabled',
      });
    });

    rooms.forEach((r) => {
      allResults.push({
        type: 'room',
        id: r.id,
        name: r.name,
        icon: r.icon || undefined,
      });
    });

    allResults.sort((a, b) => {
      const aScore = calculateScore(a, searchTerm);
      const bScore = calculateScore(b, searchTerm);
      return bScore - aScore;
    });

    res.json(allResults.slice(0, 20));
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

function calculateScore(item: any, term: string): number {
  let score = 0;
  if (item.name.toLowerCase().startsWith(term)) score += 10;
  if (item.name.toLowerCase().includes(term)) score += 5;
  if (item.description && item.description.toLowerCase().includes(term)) score += 2;
  return score;
}

export const searchRoutes = router;
