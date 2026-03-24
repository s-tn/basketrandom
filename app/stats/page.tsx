"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PlayerStat = {
  name: string;
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  games: number;
  winRate: number;
};

type SortKey = keyof PlayerStat;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Player" },
  { key: "wins", label: "Wins" },
  { key: "losses", label: "Losses" },
  { key: "winRate", label: "Win Rate" },
  { key: "goalsFor", label: "Goals For" },
  { key: "goalsAgainst", label: "Goals Against" },
];

function goalDiff(stat: PlayerStat): number {
  return stat.goalsFor - stat.goalsAgainst;
}

export default function StatsPage() {
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  }

  const sorted = [...stats].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    if (sortKey === "name") {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else {
      aVal = a[sortKey] as number;
      bVal = b[sortKey] as number;
    }

    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  function rowClass(winRate: number): string {
    if (winRate > 60) return "bg-green-50 dark:bg-green-950/30";
    if (winRate < 40) return "bg-red-50 dark:bg-red-950/30";
    return "";
  }

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-muted-foreground/40 ml-1">↕</span>;
    return <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>;
  }

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Player <span className="text-primary">Stats</span>
        </h1>
        <Badge variant="outline" className="text-sm">
          Leaderboard
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All-time Rankings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-muted-foreground text-center py-12">Loading stats...</p>
          ) : sorted.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No games played yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-10">#</th>
                    {COLUMNS.map(({ key, label }) => (
                      <th
                        key={key}
                        className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort(key)}
                      >
                        {label}
                        <SortIndicator col={key} />
                      </th>
                    ))}
                    <th
                      className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => {
                        if (sortKey === ("goalDiff" as SortKey)) {
                          setSortAsc((prev) => !prev);
                        } else {
                          setSortKey("goalsFor");
                          setSortAsc(false);
                        }
                      }}
                    >
                      Goal Diff
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((stat, i) => (
                    <tr
                      key={stat.name}
                      className={`border-b last:border-0 transition-colors ${rowClass(stat.winRate)}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold">{stat.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          {stat.wins}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                          {stat.losses}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            stat.winRate > 60
                              ? "text-green-600 dark:text-green-400 font-semibold"
                              : stat.winRate < 40
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : "text-foreground"
                          }
                        >
                          {stat.winRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">{stat.goalsFor}</td>
                      <td className="px-4 py-3">{stat.goalsAgainst}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            goalDiff(stat) > 0
                              ? "text-green-600 dark:text-green-400 font-semibold"
                              : goalDiff(stat) < 0
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {goalDiff(stat) > 0 ? `+${goalDiff(stat)}` : goalDiff(stat)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => (window.location.href = "/")}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
