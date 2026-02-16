
import React from 'react';
import { TeamForm } from './types';

interface TeamFormTabProps {
  formData: TeamForm[];
  isLoading: boolean;
  sources?: { title: string; uri: string }[];
}

const TeamFormTab: React.FC<TeamFormTabProps> = ({ formData, isLoading, sources }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Fetching Form Data...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6 px-4">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Form Guide (Last 5 Weeks)</span>
      </div>

      {/* @google/genai Coding Guidelines: Display search sources when using googleSearch */}
      {sources && sources.length > 0 && (
        <div className="px-4 mb-6 flex flex-wrap gap-2">
          {sources.map((s, idx) => (
            <a key={idx} href={s.uri} target="_blank" rel="noreferrer" className="text-[7px] font-black bg-slate-700/50 text-slate-400 px-2 py-1 rounded uppercase hover:text-white transition">
              <i className="fa-solid fa-link mr-1"></i> {s.title}
            </a>
          ))}
        </div>
      )}
      
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-700/50">
              <th className="pb-4 px-4">Team</th>
              <th className="pb-4 px-4 text-center">Last 5</th>
              <th className="pb-4 px-2 text-center">GF</th>
              <th className="pb-4 px-2 text-center">GA</th>
              <th className="pb-4 px-2 text-center">GD</th>
              <th className="pb-4 px-4 text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {formData.map((team, idx) => (
              <tr key={team.teamName} className="group hover:bg-slate-900/40 transition-all">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <img src={team.teamLogo} className="w-6 h-6 object-contain" alt={team.teamName} />
                    <span className="text-xs font-black text-white uppercase truncate max-w-[120px]">{team.teamName}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex justify-center gap-1">
                    {team.last5.map((result, i) => (
                      <div key={i} className="group/item relative">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black transition-all ${
                          result === 'W' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 
                          result === 'L' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 
                          'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                        }`}>
                          {result}
                        </div>
                        {team.details[i] && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-950 text-white text-[9px] font-bold px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition pointer-events-none z-10 border border-slate-700 shadow-2xl">
                            <span className="text-slate-500 uppercase">
                              {team.details[i].isHome ? 'Home' : 'Away'} vs {team.details[i].opponentShort}
                            </span>
                            <p className="text-xs font-black mt-0.5">{team.details[i].score}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    {[...Array(5 - team.last5.length)].map((_, i) => (
                      <div key={i} className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] font-black text-slate-600">-</div>
                    ))}
                  </div>
                </td>
                <td className="py-4 px-2 text-center text-[10px] font-bold text-slate-300">{team.goalsFor}</td>
                <td className="py-4 px-2 text-center text-[10px] font-bold text-slate-300">{team.goalsAgainst}</td>
                <td className="py-4 px-2 text-center text-[10px] font-black text-slate-400">
                  {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-sm font-black text-purple-400">{team.points}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamFormTab;
