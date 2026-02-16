
import { Team } from './types';

export const PREMIER_LEAGUE_TEAMS: Team[] = [
  { id: 'ARS', name: 'Arsenal', shortName: 'ARS', color: '#EF0107', logo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg', aliases: ['Arsenal FC', 'The Gunners', 'AFC'] },
  { id: 'AVL', name: 'Aston Villa', shortName: 'AVL', color: '#95BFE5', logo: 'https://upload.wikimedia.org/wikipedia/en/f/f9/Aston_Villa_FC_crest_%282016%29.svg', aliases: ['Villa', 'Aston', 'AVFC', 'Aston Villa FC'] },
  { id: 'BOU', name: 'Bournemouth', shortName: 'BOU', color: '#B50E12', logo: 'https://upload.wikimedia.org/wikipedia/en/e/e5/AFC_Bournemouth_%282013%29.svg', aliases: ['AFC Bournemouth', 'The Cherries', 'Bourne'] },
  { id: 'BRE', name: 'Brentford', shortName: 'BRE', color: '#E30613', logo: 'https://upload.wikimedia.org/wikipedia/en/2/2a/Brentford_FC_crest.svg', aliases: ['The Bees', 'Brentford FC'] },
  { id: 'BHA', name: 'Brighton', shortName: 'BHA', color: '#0057B8', logo: 'https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg', aliases: ['Brighton & Hove Albion', 'The Seagulls', 'Brighton Hove Albion'] },
  { id: 'CHE', name: 'Chelsea', shortName: 'CHE', color: '#034694', logo: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg', aliases: ['Chelsea FC', 'The Blues'] },
  { id: 'CRY', name: 'Crystal Palace', shortName: 'CRY', color: '#1B458F', logo: 'https://upload.wikimedia.org/wikipedia/en/a/a2/Crystal_Palace_FC_logo_%282022%29.svg', aliases: ['Palace', 'The Eagles', 'CPFC'] },
  { id: 'EVE', name: 'Everton', shortName: 'EVE', color: '#003399', logo: 'https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg', aliases: ['Everton FC', 'The Toffees'] },
  { id: 'FUL', name: 'Fulham', shortName: 'FUL', color: '#FFFFFF', logo: 'https://upload.wikimedia.org/wikipedia/en/3/3f/Fulham_FC.svg', aliases: ['Fulham FC', 'The Cottagers'] },
  { id: 'IPS', name: 'Ipswich Town', shortName: 'IPS', color: '#0033FF', logo: 'https://upload.wikimedia.org/wikipedia/en/4/43/Ipswich_Town.svg', aliases: ['Ipswich', 'The Tractor Boys', 'ITFC'] },
  { id: 'LEI', name: 'Leicester City', shortName: 'LEI', color: '#003090', logo: 'https://upload.wikimedia.org/wikipedia/en/2/2d/Leicester_City_crest.svg', aliases: ['Leicester', 'The Foxes', 'LCFC'] },
  { id: 'LIV', name: 'Liverpool', shortName: 'LIV', color: '#C8102E', logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg', aliases: ['Liverpool FC', 'The Reds'] },
  { id: 'MCI', name: 'Man City', shortName: 'MCI', color: '#6CABDD', logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg', aliases: ['Manchester City', 'MCFC', 'City'] },
  { id: 'MUN', name: 'Man Utd', shortName: 'MUN', color: '#DA291C', logo: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg', aliases: ['Manchester United', 'Man United', 'MUFC', 'United', 'The Red Devils'] },
  { id: 'NEW', name: 'Newcastle', shortName: 'NEW', color: '#241F20', logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg', aliases: ['Newcastle United', 'The Magpies', 'NUFC'] },
  { id: 'NFO', name: 'Nottm Forest', shortName: 'NFO', color: '#DD0000', logo: 'https://upload.wikimedia.org/wikipedia/en/e/e5/Nottingham_Forest_F.C._logo.svg', aliases: ['Nottingham Forest', 'Forest', 'NFFC'] },
  { id: 'SOU', name: 'Southampton', shortName: 'SOU', color: '#D71920', logo: 'https://upload.wikimedia.org/wikipedia/en/c/c9/Southampton_FC.svg', aliases: ['The Saints', 'Saints'] },
  { id: 'TOT', name: 'Tottenham', shortName: 'TOT', color: '#132257', logo: 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg', aliases: ['Spurs', 'Tottenham Hotspur', 'THFC'] },
  { id: 'WHU', name: 'West Ham', shortName: 'WHU', color: '#7A263A', logo: 'https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg', aliases: ['West Ham United', 'The Hammers', 'WHUFC'] },
  { id: 'WOL', name: 'Wolves', shortName: 'WOL', color: '#FDB913', logo: 'https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg', aliases: ['Wolverhampton Wanderers', 'WWFC'] },
];

export const INITIAL_COUPONS = [
  { id: 'entry-1', name: 'Entry #1', status: 'ACTIVE', picks: [] },
  { id: 'entry-2', name: 'Entry #2', status: 'ACTIVE', picks: [] },
];
