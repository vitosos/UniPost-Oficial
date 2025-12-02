// src/utils/analytics.ts

export type HashtagStat = {
  tag: string;
  totalLikes: number;
  totalComments: number;
  postsCount: number;
  efficiency: number; 
};

// Usamos 'any[]' para evitar dependencias circulares, pero esperamos la estructura de Metric
export function calculateHashtagPerformance(metrics: any[]): HashtagStat[] {
  const statsMap = new Map<string, HashtagStat>();

  // Regex para hashtags
  const hashtagRegex = /#[\p{L}\p{N}_]+/gu;

  metrics.forEach((m) => {
    const text = m.post?.text || "";
    const matches = text.match(hashtagRegex);

    if (matches) {
      const uniqueTags = new Set<string>(matches);

      for (const tagRaw of uniqueTags) {
        const tag = tagRaw.toLowerCase(); 

        if (!statsMap.has(tag)) {
          statsMap.set(tag, {
            tag: tagRaw, // Ahora tagRaw es garantizado string
            totalLikes: 0,
            totalComments: 0,
            postsCount: 0,
            efficiency: 0,
          });
        }

        const current = statsMap.get(tag)!;
        current.totalLikes += m.likes;
        current.totalComments += m.comments;
        current.postsCount += 1;
      }
    }
  });

  return Array.from(statsMap.values())
    .map((stat) => ({
      ...stat,
      efficiency: (stat.totalLikes + stat.totalComments) / stat.postsCount,
    }))
    .sort((a, b) => b.totalLikes - a.totalLikes);
}