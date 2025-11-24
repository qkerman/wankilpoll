import { useEffect, useState } from "react";

import "./App.css";

function App() {
  const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTh3Yhj4a01BmOlK9dPQlv-B525nDC_AJS3M9rIKx33SOwRt1eyuQ8D_zDBXJ0D5nUyMBVfXdVJFikt/pub?output=csv";

  // No API key needed for Wikipedia

  const [topGames, setTopGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const DEFAULT_IMAGE =
    "https://upload.wikimedia.org/wikipedia/commons/f/f8/Question_mark_alternate.svg";

  // Load image cache from localStorage
  const loadImageCache = () => {
    try {
      const cached = localStorage.getItem("wankilpoll_images");
      return cached ? new Map(JSON.parse(cached)) : new Map();
    } catch {
      return new Map();
    }
  };

  // Save image cache to localStorage
  const saveImageCache = (cache) => {
    try {
      localStorage.setItem("wankilpoll_images", JSON.stringify([...cache]));
    } catch (err) {
      console.error("Failed to save cache:", err);
    }
  };

  const [imageCache, setImageCache] = useState(loadImageCache);
  const knownImages = {
    Roblox:
      "https://logos-world.net/wp-content/uploads/2020/11/Roblox-Logo.png",
    Phasmophobia:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Phasmophobia_cover.jpg/256px-Phasmophobia_cover.jpg",
    Misery:
      "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2119830/f4aa2f3b4b352f7f373026fe592d32eef2c72fce/header.jpg?t=1763600148",
    "Neighbors Suburban Warfare":
      "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1732430/80b8baec5e77c8338c3931182b631fbde5c5a083/header.jpg?t=1760704191",
    Mimesis:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKLSqcFrpF_OJqPExclC2stRGJTKo1jnb3F-CyIYklHktOuIV2xajJibU_mh_cCApnc0jeoU_uH3WBqSmvKKiR8_sJ5ZGxe0pi-xn0q7F9HQ&s=10",
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
          .map((row) => {
            // Split by comma, but need to handle the quoted field with multiple answers
            const match = row.match(/^[^,]*,\s*"([^"]*)"/);
            if (match) {
              // Extract timestamp and quoted games field
              const timestamp = row.substring(0, row.indexOf(","));
              const gamesField = match[1];
              return [timestamp.trim(), gamesField];
            }
            // Fallback to simple split if no quotes found
            return row.split(",").map((cell) => cell.trim());
          });
        const headers = rows[0];
        const gameIndex = 1; // "Choisir un jeu" is the second column
        const voteCounts = {};
        for (let i = 1; i < rows.length; i++) {
          const gamesField = rows[i][gameIndex];
          if (gamesField) {
            // Split by comma to handle multiple games in one response
            const games = gamesField
              .split(",")
              .map((game) => game.trim())
              .filter((game) => game);
            games.forEach((game) => {
              voteCounts[game] = (voteCounts[game] || 0) + 1;
            });
          }
        }
        const sortedGames = Object.entries(voteCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, votes]) => ({ name, votes }));

        // Fetch images for each game from Wikipedia
        const newCache = new Map(imageCache);
        const gamesWithImages = await Promise.all(
          sortedGames.map(async (game) => {
            // Priority 1: Check knownImages first (allows manual override)
            if (knownImages[game.name]) {
              newCache.set(game.name, knownImages[game.name]);
              return { ...game, image: knownImages[game.name] };
            }
            // Priority 2: Check cache
            if (newCache.has(game.name)) {
              return { ...game, image: newCache.get(game.name) };
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
              newCache.set(game.name, image);
              return { ...game, image };
            } catch (err) {
              //console.error(`Error fetching image for ${game.name}:`, err);
              newCache.set(game.name, DEFAULT_IMAGE);
              return { ...game, image: DEFAULT_IMAGE };
            }
          })
        );

        // Save updated cache to localStorage
        setImageCache(newCache);
        saveImageCache(newCache);
        setTopGames(gamesWithImages);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching sheet:", err);
        setLoading(false);
      }
    };

    fetchSheet(); // initial fetch
    const interval = setInterval(fetchSheet, 100000); // poll every 100s
    return () => clearInterval(interval);
  }, []);

  // Create placeholders if there are less than 10 games
  const displayGames = [...topGames];
  while (displayGames.length < 10) {
    displayGames.push({
      name: "En attente...",
      votes: 0,
      image: DEFAULT_IMAGE,
      isPlaceholder: true,
    });
  }

  return (
    <div className="app">
      {loading && topGames.length === 0 ? (
        <div className="loading">Chargement...</div>
      ) : (
        <>
          {displayGames.length >= 3 && (
            <div className="podium">
              {/* 2nd place */}
              <div className="podium-item second">
                <div className="rank">2</div>
                <img
                  src={displayGames[1]?.image || DEFAULT_IMAGE}
                  alt={displayGames[1]?.name}
                />
                <div className="game-name" title={displayGames[1]?.name}>
                  {displayGames[1]?.name}
                </div>
                <div className="votes">
                  {displayGames[1]?.votes} vote
                  {displayGames[1]?.votes > 1 ? "s" : ""}
                </div>
              </div>
              {/* 1st place */}
              <div className="podium-item first">
                <div className="rank">1</div>
                <img
                  src={displayGames[0]?.image || DEFAULT_IMAGE}
                  alt={displayGames[0]?.name}
                />
                <div className="game-name" title={displayGames[0]?.name}>
                  {displayGames[0]?.name}
                </div>
                <div className="votes">
                  {displayGames[0]?.votes} vote
                  {displayGames[0]?.votes > 1 ? "s" : ""}
                </div>
              </div>
              {/* 3rd place */}
              <div className="podium-item third">
                <div className="rank">3</div>
                <img
                  src={displayGames[2]?.image || DEFAULT_IMAGE}
                  alt={displayGames[2]?.name}
                />
                <div className="game-name" title={displayGames[2]?.name}>
                  {displayGames[2]?.name}
                </div>
                <div className="votes">
                  {displayGames[2]?.votes} vote
                  {displayGames[2]?.votes > 1 ? "s" : ""}
                </div>
              </div>
            </div>
          )}
          <div className="others">
            {displayGames.slice(3).map((game, i) => (
              <div
                className={`game-card ${
                  game.isPlaceholder ? "placeholder" : ""
                }`}
                key={i + 4}
              >
                <div className="rank">{i + 4}</div>
                <img src={game.image || DEFAULT_IMAGE} alt={game.name} />
                <div className="game-name" title={game.name}>
                  {game.name}
                </div>
                <div className="votes">{game.votes} vote</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
