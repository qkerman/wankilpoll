import { useEffect, useState } from "react";

import "./App.css";

function App() {
  const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTh3Yhj4a01BmOlK9dPQlv-B525nDC_AJS3M9rIKx33SOwRt1eyuQ8D_zDBXJ0D5nUyMBVfXdVJFikt/pub?output=csv";

  // No API key needed for Wikipedia

  const [topGames, setTopGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const imageCache = new Map();
  const DEFAULT_IMAGE =
    "https://upload.wikimedia.org/wikipedia/commons/f/f8/Question_mark_alternate.svg";
  const knownImages = {
    Roblox:
      "https://logos-world.net/wp-content/uploads/2020/11/Roblox-Logo.png",
    Phasmophobia:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Phasmophobia_cover.jpg/256px-Phasmophobia_cover.jpg",
    "Lost Ark":
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Lost_Ark_cover_art.jpg/256px-Lost_Ark_cover_art.jpg",
  };

  useEffect(() => {
    const fetchSheet = async () => {
      try {
        setLoading(true);
        // Add timestamp to bust cache
        const cacheBuster = `${SHEET_URL}&_=${Date.now()}`;
        const res = await fetch(cacheBuster, {
          cache: "no-store",
        });
        const text = await res.text();
        const rows = text
          .trim()
          .split("\n")
          .map((row) => row.split(",").map((cell) => cell.trim()));
        const headers = rows[0];
        const gameIndex = 1; // "Choisir un jeu" is the second column
        const voteCounts = {};
        for (let i = 1; i < rows.length; i++) {
          const game = rows[i][gameIndex];
          voteCounts[game] = (voteCounts[game] || 0) + 1;
        }
        const sortedGames = Object.entries(voteCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, votes]) => ({ name, votes }));

        // Fetch images for each game from Wikipedia
        const gamesWithImages = await Promise.all(
          sortedGames.map(async (game) => {
            if (imageCache.has(game.name)) {
              return { ...game, image: imageCache.get(game.name) };
            }
            try {
              let image = null;
              // Priority order: (video game) > (game) > default name
              const titleGroups = [
                [
                  `${game.name} (video game)`,
                  `${game.name.toUpperCase()} (video game)`,
                  `${game.name.toLowerCase()} (video game)`,
                ],
                [
                  `${game.name} (game)`,
                  `${game.name.toUpperCase()} (game)`,
                  `${game.name.toLowerCase()} (game)`,
                ],
                [game.name, game.name.toUpperCase(), game.name.toLowerCase()],
              ];

              // Try each group in priority order
              for (const titleGroup of titleGroups) {
                for (const title of titleGroup) {
                  const wikiRes = await fetch(
                    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
                      title
                    )}`,
                    {
                      headers: {
                        "User-Agent":
                          "WankilPoll/1.0 (https://example.com; contact@example.com)",
                      },
                    }
                  );
                  if (wikiRes.ok) {
                    const wikiData = await wikiRes.json();
                    image = wikiData.thumbnail?.source || null;
                    if (image) break;
                  }
                }
                if (image) break; // Stop if we found an image in this priority group
              }

              // Fallback to known images
              if (!image && knownImages[game.name]) {
                image = knownImages[game.name];
              }
              // Fallback to default image if still not found
              if (!image) {
                image = DEFAULT_IMAGE;
              }
              imageCache.set(game.name, image);
              return { ...game, image };
            } catch (err) {
              //console.error(`Error fetching image for ${game.name}:`, err);
              imageCache.set(game.name, DEFAULT_IMAGE);
              return { ...game, image: DEFAULT_IMAGE };
            }
          })
        );

        setTopGames(gamesWithImages);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching sheet:", err);
        setLoading(false);
      }
    };

    fetchSheet(); // initial fetch
    const interval = setInterval(fetchSheet, 30000); // poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      {loading && topGames.length === 0 ? (
        <div className="loading">Chargement...</div>
      ) : (
        <>
          {topGames.length >= 3 && (
            <div className="podium">
              {/* 2nd place */}
              <div className="podium-item second">
                <div className="rank">2</div>
                <img
                  src={topGames[1]?.image || DEFAULT_IMAGE}
                  alt={topGames[1]?.name}
                />
                <div className="game-name" title={topGames[1]?.name}>
                  {topGames[1]?.name}
                </div>
                <div className="votes">{topGames[1]?.votes} votes</div>
              </div>
              {/* 1st place */}
              <div className="podium-item first">
                <div className="rank">1</div>
                <img
                  src={topGames[0]?.image || DEFAULT_IMAGE}
                  alt={topGames[0]?.name}
                />
                <div className="game-name" title={topGames[0]?.name}>
                  {topGames[0]?.name}
                </div>
                <div className="votes">{topGames[0]?.votes} votes</div>
              </div>
              {/* 3rd place */}
              <div className="podium-item third">
                <div className="rank">3</div>
                <img
                  src={topGames[2]?.image || DEFAULT_IMAGE}
                  alt={topGames[2]?.name}
                />
                <div className="game-name" title={topGames[2]?.name}>
                  {topGames[2]?.name}
                </div>
                <div className="votes">{topGames[2]?.votes} votes</div>
              </div>
            </div>
          )}
          <div className="others">
            {topGames.slice(3).map((game, i) => (
              <div className="game-card" key={i + 4}>
                <div className="rank">{i + 4}</div>
                <img src={game.image || DEFAULT_IMAGE} alt={game.name} />
                <div className="game-name" title={game.name}>
                  {game.name}
                </div>
                <div className="votes">{game.votes} votes</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
