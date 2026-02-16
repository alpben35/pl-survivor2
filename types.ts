
export type TeamStatus = 'WIN' | 'DRAW' | 'LOSS' | 'PENDING';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logo: string;
  aliases?: string[]; 
}

export interface Pick {
  week: number;
  teamId: string;
}

export interface Competition {
  id: string;
  name: string;
  creatorNickname: string;
  currentWeek: number;
  status: 'OPEN' | 'ONGOING' | 'FINISHED';
  history: WeeklyResult[];
}

export interface Coupon {
  id: string;
  competitionId: string;
  name: string;
  ownerNickname: string;
  status: 'ACTIVE' | 'ELIMINATED' | 'WINNER';
  picks: Pick[];
  createdAtWeek: number; // Added to track when the entry joined for buy-in rules
}

export interface WeeklyResult {
  week: number;
  results: Record<string, TeamStatus>; // teamId -> status
}

export interface AppState {
  userNickname: string | null;
  userCoins: number; 
  competitions: Competition[];
  coupons: Coupon[];
  selectedCompetitionId: string | null;
  isAdminMode: boolean; 
  plData: PLData | null; 
}

export interface LeagueTableEntry {
  position: number;
  team: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gd: number;
  points: number;
  form?: string[]; 
}

export interface TeamForm {
  teamName: string;
  teamLogo: string;
  last5: ("W" | "D" | "L")[];
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  details: {
    opponentShort: string;
    result: "W" | "D" | "L";
    score: string;
    isHome: boolean;
  }[];
}

export interface Fixture {
  homeTeam: string;
  awayTeam: string;
  score?: string;
  status: 'LIVE' | 'FT' | 'SCHEDULED';
  time?: string;
  liveTime?: string; 
}

export interface PLData {
  table: LeagueTableEntry[];
  currentFixtures: Fixture[];
  nextFixtures: Fixture[];
  results: Record<string, TeamStatus>; 
  sources: { title: string; uri: string }[];
  lastUpdated: string; 
}
