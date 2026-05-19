/**
 * Union-Find (Disjoint Set Union) data structure with path compression and union by rank.
 *
 * Used to build clusters from duplicate pairs.
 */

export class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  /**
   * Find the root of the set containing id.
   * Uses path compression for efficiency.
   */
  find(id: string): string {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
      return id;
    }

    // Path compression
    if (this.parent.get(id) !== id) {
      this.parent.set(id, this.find(this.parent.get(id)!));
    }

    return this.parent.get(id)!;
  }

  /**
   * Union two sets by rank.
   */
  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) return;

    const rankA = this.rank.get(rootA) || 0;
    const rankB = this.rank.get(rootB) || 0;

    // Union by rank
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
  }

  /**
   * Get all clusters with 2+ members.
   * Returns array of record ID arrays.
   */
  getClusters(): string[][] {
    const clusters = new Map<string, string[]>();

    for (const id of this.parent.keys()) {
      const root = this.find(id);
      if (!clusters.has(root)) {
        clusters.set(root, []);
      }
      clusters.get(root)!.push(id);
    }

    // Return only clusters with 2+ members
    return Array.from(clusters.values()).filter(cluster => cluster.length >= 2);
  }
}
