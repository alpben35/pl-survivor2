
// footballApiService.ts

/**
 * The football-data.org API token. 
 */
const FOOTBALL_TOKEN = "434916e4f8e2453cb5785ebaa9239f44";

/**
 * Helper to build the API URL.
 */
const getApiUrl = (path: string) => {
  const baseUrl = "https://api.football-data.org/v4";
  const fullUrl = `${baseUrl}/${path}`;
  // Using corsproxy.io to bypass CORS issues in preview environments.
  return `https://corsproxy.io/?${encodeURIComponent(fullUrl)}`;
};

const getHeaders = () => ({
  "X-Auth-Token": FOOTBALL_TOKEN,
  "Content-Type": "application/json"
});

export async function getPremierLeagueStandings() {
  try {
    const response = await fetch(getApiUrl("competitions/PL/standings"), {
      method: "GET",
      headers: getHeaders()
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    const totalStandings = data.standings?.find((s: any) => s.type === "TOTAL");
    return totalStandings?.table || [];
  } catch (error) {
    console.error("Standings fetch error:", error);
    return [];
  }
}

export async function getUpcomingPremierLeagueMatches() {
  try {
    const response = await fetch(getApiUrl("competitions/PL/matches?status=SCHEDULED"), {
      method: "GET",
      headers: getHeaders()
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error("Matches fetch error:", error);
    return [];
  }
}

export async function getFinishedPremierLeagueMatches() {
  try {
    const response = await fetch(getApiUrl("competitions/PL/matches?status=FINISHED"), {
      method: "GET",
      headers: getHeaders()
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error("Historical matches fetch error:", error);
    return [];
  }
}
