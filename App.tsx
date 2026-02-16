// App.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { PREMIER_LEAGUE_TEAMS } from './constants';
import { AppState, Competition, Coupon, LeagueTableEntry, TeamStatus, TeamForm } from './types';
import { getStandingsViaSearch, getFormViaSearch } from './geminiService';
import { getPremierLeagueStandings, getUpcomingPremierLeagueMatches } from './footballApiService';
import TeamFormTab from './TeamFormTab';

const ENTRY_COST = 10;
const MAX_ENTRIES_PER_POOL = 2;
const LOCK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

const isMatchLocked = (utcDate: string) => {
  const matchTime = new Date(utcDate).getTime();
  const now = new Date().getTime();
  return (matchTime - now) < LOCK_THRESHOLD_MS;
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const savedStr = localStorage.getItem('pl-survivor-v4');
    const baseState: AppState = {
      userNickname: null,
      userCoins: 50, 
      competitions: [],
      coupons: [],
      selectedCompetitionId: null,
      isAdminMode: false,
      plData: {
        table: [],
        currentFixtures: [],
        nextFixtures: [],
        results: {},
        sources: [],
        lastUpdated: new Date().toISOString()
      }
    };

    if (savedStr) {
      try {
        const saved = JSON.parse(savedStr);
        return {
          ...baseState,
          ...saved,
          plData: saved.plData || baseState.plData 
        };
      } catch (e) {
        return baseState;
      }
    }
    return baseState;
  });

  const [activeView, setActiveView] = useState<'GAME' | 'DASHBOARD'>('GAME');
  const [lobbyTab, setLobbyTab] = useState<'OVERVIEW' | 'POOLS' | 'RULES'>('OVERVIEW');
  const [activeCouponId, setActiveCouponId] = useState<string | null>(null);
  const [tempNickname, setTempNickname] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdminHub, setShowAdminHub] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isMatchesLoading, setIsMatchesLoading] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [dataTab, setDataTab] = useState<'MATCHES' | 'TABLE' | 'FORM'>('MATCHES');
  const [pendingPick, setPendingPick] = useState<{ teamId: string; teamName: string; logo: string; week: number } | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [searchFormResult, setSearchFormResult] = useState<{ form: TeamForm[], sources: { title: string, uri: string }[] }>({ form: [], sources: [] });
  const [selectedMatchweek, setSelectedMatchweek] = useState<number | null>(null);

  const safeSelectedComp: Competition | null = useMemo(
    () => state.competitions.find(c => c.id === state.selectedCompetitionId) || null,
    [state.competitions, state.selectedCompetitionId]
  );

  const allCouponsInComp = useMemo(() => state.coupons.filter(c => c.competitionId === state.selectedCompetitionId), [state.coupons, state.selectedCompetitionId]);
  const myCouponsInComp = useMemo(() => allCouponsInComp.filter(c => c.ownerNickname === state.userNickname), [allCouponsInComp, state.userNickname]);

  const selectionBreakdown = useMemo(() => {
    if (!safeSelectedComp) return [];
    const week = safeSelectedComp.currentWeek;
    const counts: Record<string, number> = {};
    allCouponsInComp.forEach(c => {
      if (c.status === 'ACTIVE') {
        const pick = c.picks.find(p => p.week === week);
        if (pick) {
          counts[pick.teamId] = (counts[pick.teamId] || 0) + 1;
        }
      }
    });
    return Object.entries(counts)
      .map(([teamId, count]) => ({
        team: PREMIER_LEAGUE_TEAMS.find(t => t.id === teamId),
        count
      }))
      .sort((a, b) => b.count - a.count);
  }, [safeSelectedComp, allCouponsInComp]);

  const standingsWeeks = useMemo(() => {
    if (!safeSelectedComp) return [];
    let maxWeek = safeSelectedComp.currentWeek;
    allCouponsInComp.forEach(c => {
      c.picks.forEach(p => { if (p.week > maxWeek) maxWeek = p.week; });
    });
    return Array.from({ length: Math.max(safeSelectedComp.currentWeek, maxWeek) }, (_, i) => i + 1);
  }, [safeSelectedComp, allCouponsInComp]);

  useEffect(() => {
    async function loadData() {
      setIsTableLoading(true);
      setIsFormLoading(true);
      setIsMatchesLoading(true);

      const [standings, searchForm, upcomingMatches] = await Promise.all([
        getPremierLeagueStandings(),
        getFormViaSearch(),
        getUpcomingPremierLeagueMatches()
      ]);

      if (standings && Array.isArray(standings) && standings.length > 0) {
        const formattedTable: LeagueTableEntry[] = standings.map((item: any) => ({
          position: item.position || 0,
          team: item.team?.name || "Unknown",
          played: item.playedGames || 0,
          win: item.won || 0,
          draw: item.draw || 0,
          loss: item.lost || 0,
          gd: item.goalDifference !== undefined ? item.goalDifference : 0,
          points: item.points || 0,
        }));
        setState(prev => ({ 
          ...prev, 
          plData: prev.plData ? { ...prev.plData, table: formattedTable, lastUpdated: new Date().toISOString() } : null 
        }));
      } else {
        const aiStandings = await getStandingsViaSearch();
        setState(prev => ({ 
          ...prev, 
          plData: prev.plData ? { ...prev.plData, table: aiStandings.table, sources: aiStandings.sources, lastUpdated: new Date().toISOString() } : null 
        }));
      }

      const processedForm: TeamForm[] = searchForm.form.map((raw: any) => {
        const team = PREMIER_LEAGUE_TEAMS.find(t => 
          t.name.toLowerCase() === raw.teamName.toLowerCase() || 
          t.aliases?.some(a => a.toLowerCase() === raw.teamName.toLowerCase())
        );
        const last5 = (raw.last5 || []).slice(0, 5).map((r: string) => {
          const res = r.toUpperCase();
          return (res === 'W' || res === 'D' || res === 'L') ? res : 'D';
        });
        const pts = last5.reduce((acc: number, r: string) => acc + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
        return {
          teamName: team?.name || raw.teamName,
          teamLogo: team?.logo || 'https://via.placeholder.com/50',
          last5: last5,
          goalsFor: raw.goalsFor || 0,
          goalsAgainst: raw.goalsAgainst || 0,
          goalDifference: (raw.goalsFor || 0) - (raw.goalsAgainst || 0),
          points: pts,
          details: []
        };
      });

      setSearchFormResult({ 
        form: processedForm.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference), 
        sources: searchForm.sources 
      });

      setMatches(upcomingMatches);
      if (upcomingMatches.length > 0) {
        const firstMD = upcomingMatches.reduce((min: number, m: any) => m.matchday < min ? m.matchday : min, upcomingMatches[0].matchday);
        setSelectedMatchweek(firstMD);
      }

      setIsTableLoading(false);
      setIsFormLoading(false);
      setIsMatchesLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    const { plData, ...persistentState } = state;
    localStorage.setItem('pl-survivor-v4', JSON.stringify(persistentState));
  }, [state]);

  const groupedMatches = useMemo(() => {
    const groups: Record<number, any[]> = {};
    matches.forEach(m => {
      if (!groups[m.matchday]) groups[m.matchday] = [];
      groups[m.matchday].push(m);
    });
    return groups;
  }, [matches]);

  const matchweekList = useMemo(() => {
    return Object.keys(groupedMatches).map(Number).sort((a, b) => a - b);
  }, [groupedMatches]);

  const safeActiveCoupon: Coupon | null = useMemo(() => 
    state.coupons.find(c => c.id === activeCouponId) || null, 
  [state.coupons, activeCouponId]);
  
  const currentPickInView = useMemo(() => {
    if (!safeActiveCoupon || selectedMatchweek === null) return null;
    return safeActiveCoupon.picks.find(p => p.week === selectedMatchweek) || null;
  }, [safeActiveCoupon, selectedMatchweek]);

  const sortedTable = useMemo(() => {
    if (!state.plData?.table) return [];
    return [...state.plData.table].sort((a, b) => b.points - a.points || b.gd - a.gd);
  }, [state.plData?.table]);

  const shareReport = () => {
    if (!safeSelectedComp) return;
    const week = safeSelectedComp.currentWeek;
    const survivors = allCouponsInComp.filter(c => c.status === 'ACTIVE');
    let text = `🏆 *PL SURVIVOR ELITE* 🏆\n*Pool:* ${safeSelectedComp.name}\n*MW ${week} Report*\n--------------------------\n`;
    text += `🛡️ *Survivors:* ${survivors.length}\n`;
    survivors.forEach(c => {
      const pick = c.picks.find(p => p.week === week);
      const team = PREMIER_LEAGUE_TEAMS.find(t => t.id === pick?.teamId);
      text += `- ${c.name}: ${team?.name || 'Waiting...'}\n`;
    });
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handlePickRequest = (teamId: string, week: number) => {
    const team = PREMIER_LEAGUE_TEAMS.find(t => t.id === teamId);
    if (!team || !safeActiveCoupon || safeActiveCoupon.status !== 'ACTIVE' || !safeSelectedComp) return;
    
    const match = matches.find(m => m.matchday === week && (m.homeTeam.name === team.name || m.awayTeam.name === team.name || team.aliases?.some(a => m.homeTeam.name === a || m.awayTeam.name === a)));
    if (match && isMatchLocked(match.utcDate)) return alert("Match is locked!");

    const usedInThisCouponForOtherWeek = safeActiveCoupon.picks.some(p => p.teamId === teamId && p.week !== week);
    if (usedInThisCouponForOtherWeek) return alert("You already used this team!");

    const usedByManagerInPast = myCouponsInComp.some(c => 
      c.picks.some(p => p.teamId === teamId && p.week < week)
    );
    if (usedByManagerInPast) return alert("You already picked this team in a previous matchweek!");

    setPendingPick({ teamId: team.id, teamName: team.name, logo: team.logo, week });
  };

  const addEntry = () => {
    if (!state.selectedCompetitionId || !safeSelectedComp) return;
    if (myCouponsInComp.length >= MAX_ENTRIES_PER_POOL) return alert(`Max ${MAX_ENTRIES_PER_POOL} entries allowed.`);
    if (state.userCoins < ENTRY_COST) return alert("Insufficient coins!");
    
    const newCoupon: Coupon = { 
      id: `entry-${Date.now()}`, 
      competitionId: state.selectedCompetitionId, 
      name: `Entry #${myCouponsInComp.length + 1}`, 
      ownerNickname: state.userNickname || "Manager", 
      status: 'ACTIVE', 
      picks: [],
      createdAtWeek: safeSelectedComp.currentWeek
    };
    setState(prev => ({ 
      ...prev, 
      userCoins: prev.userCoins - ENTRY_COST,
      coupons: [...prev.coupons, newCoupon] 
    }));
    setActiveCouponId(newCoupon.id);
  };

  const resolveWeek = () => {
    if (!safeSelectedComp || !state.plData) return;
    const currentWeek = safeSelectedComp.currentWeek;
    const outcomes = state.plData.results;
    
    setState(prev => ({
      ...prev,
      coupons: prev.coupons.map(coupon => {
        if (coupon.competitionId !== prev.selectedCompetitionId || coupon.status !== 'ACTIVE') return coupon;
        const pick = coupon.picks.find(p => p.week === currentWeek);
        const team = pick ? PREMIER_LEAGUE_TEAMS.find(t => t.id === pick.teamId) : null;
        if (!team || outcomes[team.name] !== 'WIN') return { ...coupon, status: 'ELIMINATED' as const };
        return coupon;
      }),
      competitions: prev.competitions.map(comp => comp.id === prev.selectedCompetitionId ? { ...comp, currentWeek: comp.currentWeek + 1 } : comp),
      plData: prev.plData ? { ...prev.plData, results: {}, currentFixtures: [] } : null
    }));
    setShowResolveModal(false);
    setActiveView('DASHBOARD');
  };

  if (!state.userNickname) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-8">Survivor <span className="text-indigo-500">Elite</span></h1>
        <div className="max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-3xl p-8 shadow-2xl">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Initialize Manager Alias</h3>
          <form onSubmit={(e) => { e.preventDefault(); if(tempNickname.trim()) setState(p => ({ ...p, userNickname: tempNickname.trim(), userCoins: 50 })); }} className="space-y-4">
            <input type="text" value={tempNickname} onChange={e => setTempNickname(e.target.value)} placeholder="Manager Name" className="w-full bg-[#0d1117] border border-[#30363d] rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all shadow-xl">Enter Arena</button>
          </form>
        </div>
      </div>
    );
  }

  if (!state.selectedCompetitionId) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <header className="flex flex-col md:flex-row justify-between items-center mb-16 bg-[#161b22] p-10 rounded-[2.5rem] border border-[#30363d] shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <h1 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">Command Center</h1>
              <div className="flex items-center gap-3 mt-4">
                 <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Manager: {state.userNickname}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 mt-8 md:mt-0 relative z-10">
              <div className="bg-[#0d1117] border border-amber-500/20 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-inner">
                <i className="fa-solid fa-coins text-amber-500 text-2xl"></i>
                <span className="text-3xl font-black text-white tracking-tighter">{state.userCoins}</span>
              </div>
              <button onClick={() => setShowCreateModal(true)} className="px-8 py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 hover:scale-[1.05]">
                Launch Pool
              </button>
            </div>
          </header>

          <nav className="flex gap-4 mb-12 border-b border-[#30363d]">
            {(['OVERVIEW', 'POOLS', 'RULES'] as const).map(tab => (
              <button key={tab} onClick={() => setLobbyTab(tab)} className={`pb-4 px-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-2 ${lobbyTab === tab ? 'border-indigo-500 text-white' : 'border-transparent text-slate-600 hover:text-slate-300'}`}>
                {tab}
              </button>
            ))}
          </nav>

          {lobbyTab === 'POOLS' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {state.competitions.length === 0 ? (
                <div className="col-span-full py-32 text-center border-4 border-dashed border-[#30363d] rounded-[3rem]">
                   <i className="fa-solid fa-ghost text-4xl text-slate-700 mb-6"></i>
                   <p className="text-xl font-black text-slate-500 uppercase italic tracking-tighter">No Active Pools Found</p>
                </div>
              ) : (
                state.competitions.map(comp => {
                   const myEntries = state.coupons.filter(c => c.competitionId === comp.id && c.ownerNickname === state.userNickname);
                   return (
                    <button key={comp.id} onClick={() => {
                        setState(s => ({ ...s, selectedCompetitionId: comp.id }));
                        setActiveCouponId(myEntries[0]?.id || null);
                    }} className="bg-[#161b22] border border-[#30363d] rounded-[2rem] p-8 text-left hover:border-indigo-500 transition-all group relative overflow-hidden shadow-xl hover:-translate-y-2">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 block">Pool</span>
                      <h3 className="text-2xl font-black text-white mb-6 uppercase italic">{comp.name}</h3>
                      <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                        <span>Matchweek {comp.currentWeek}</span>
                        <span>{comp.status}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : lobbyTab === 'RULES' ? (
            <div className="max-w-3xl mx-auto space-y-8 py-12">
               {[
                 { q: 'How many entries can I have?', a: `Each manager can have a maximum of ${MAX_ENTRIES_PER_POOL} entries per pool.` },
                 { q: 'What happens in a draw?', a: 'Draws are considered failures. Only a WIN survives.' },
                 { q: 'When are picks locked?', a: 'Picks are locked 1 hour before the scheduled kickoff.' }
               ].map((faq, i) => (
                 <div key={i} className="bg-[#161b22] border border-[#30363d] p-8 rounded-3xl">
                    <h4 className="text-lg font-black uppercase italic mb-4 text-white">{faq.q}</h4>
                    <p className="text-slate-500 font-medium leading-relaxed">{faq.a}</p>
                 </div>
               ))}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-600 font-black uppercase italic tracking-widest">Select POOLS to enter or create an active competition</div>
          )}
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 z-50">
            <div className="bg-[#161b22] border border-[#30363d] w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl">
              <h2 className="text-3xl font-black text-white mb-8 uppercase italic tracking-tighter">Launch New Pool</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                if(!newCompName.trim()) return;
                const comp: Competition = { id: `c-${Date.now()}`, name: newCompName.trim(), creatorNickname: state.userNickname || "Manager", currentWeek: 1, status: 'OPEN', history: [] };
                setState(s => ({ ...s, competitions: [...s.competitions, comp], selectedCompetitionId: comp.id }));
                setShowCreateModal(false);
              }} className="space-y-6">
                <input type="text" value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="Pool Identifier" className="w-full bg-[#0d1117] border border-[#30363d] rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                <button className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest shadow-lg shadow-indigo-600/20">Establish Pool</button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="w-full py-2 text-slate-500 font-bold uppercase text-[10px]">Cancel</button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!safeSelectedComp) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Synchronizing Pool Data...</p>
        </div>
      </div>
    );
  }

  const currentMatchweekLabel = safeSelectedComp.currentWeek;

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 overflow-x-hidden relative">
      <div className="max-w-7xl mx-auto px-4 py-8 pb-32">
        <header className="flex justify-between items-center mb-8 bg-[#161b22]/60 backdrop-blur-xl p-6 rounded-3xl border border-white/5 shadow-xl">
          <div className="flex items-center gap-4">
            <button onClick={() => setState(s => ({ ...s, selectedCompetitionId: null }))} className="p-3 bg-[#0d1117] text-slate-400 rounded-xl hover:text-white transition"><i className="fa-solid fa-arrow-left"></i></button>
            <div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">{safeSelectedComp?.name}</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Pool Hub • Week {currentMatchweekLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-[#0d1117] px-5 py-3 rounded-2xl flex items-center gap-3 border border-amber-500/20 shadow-inner">
                <i className="fa-solid fa-coins text-amber-500"></i>
                <span className="text-xl font-black">{state.userCoins}</span>
            </div>
            <button onClick={() => setShowAdminHub(true)} className="px-6 py-3 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition shadow-lg">Admin Hub</button>
          </div>
        </header>

        {activeView === 'GAME' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-[#161b22]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="flex bg-[#0d1117]/50 p-2 gap-2 border-b border-white/5">
                  {(['MATCHES', 'TABLE', 'FORM'] as const).map(tab => (
                    <button key={tab} onClick={() => setDataTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${dataTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                      {tab}
                    </button>
                  ))}
                </div>
                
                <div className="p-8 max-h-[800px] overflow-y-auto no-scrollbar">
                  {dataTab === 'MATCHES' ? (
                    <div className="space-y-8">
                      {selectionBreakdown.length > 0 && (
                        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6 mb-8 animate-fade-in">
                           <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Weekly Selection Summary (Week {currentMatchweekLabel})</h3>
                           <div className="flex flex-wrap gap-4">
                              {selectionBreakdown.map(item => (
                                <div key={item.team?.id} className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
                                   <img src={item.team?.logo} className="w-5 h-5 object-contain" alt={item.team?.name} />
                                   <span className="text-xs font-black text-white">{item.count} <span className="text-slate-500">PICKED</span></span>
                                </div>
                              ))}
                           </div>
                        </div>
                      )}

                      <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar">
                        {matchweekList.map(mw => (
                          <button key={mw} onClick={() => setSelectedMatchweek(mw)} className={`flex-shrink-0 px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedMatchweek === mw ? 'bg-indigo-600 text-white' : 'bg-[#161b22] text-slate-500 hover:text-slate-300'}`}>
                            MW {mw}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        {selectedMatchweek !== null && groupedMatches[selectedMatchweek] ? (
                          groupedMatches[selectedMatchweek].map((match: any) => {
                            const homeTeam = PREMIER_LEAGUE_TEAMS.find(t => t.name === match.homeTeam.name || t.aliases?.includes(match.homeTeam.name));
                            const awayTeam = PREMIER_LEAGUE_TEAMS.find(t => t.name === match.awayTeam.name || t.aliases?.includes(match.awayTeam.name));
                            return (
                              <div key={match.id} className="bg-black/20 border border-white/5 rounded-3xl p-6 flex justify-between items-center group hover:border-white/20 transition-all shadow-lg">
                                 <button onClick={() => homeTeam && selectedMatchweek !== null && handlePickRequest(homeTeam.id, selectedMatchweek)} className="flex-1 flex flex-col items-center gap-2 hover:scale-105 transition-all">
                                    <img src={homeTeam?.logo} className="w-12 h-12 object-contain" alt={homeTeam?.name} />
                                    <span className="text-[11px] font-black text-white uppercase text-center">{match.homeTeam.name}</span>
                                 </button>
                                 <div className="flex flex-col items-center px-10">
                                    <span className="text-[24px] font-black text-white italic tracking-tighter">{match.score?.fullTime?.home ?? '-'} : {match.score?.fullTime?.away ?? '-'}</span>
                                    <span className="text-[8px] font-bold text-slate-500 uppercase mt-2">{new Date(match.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                 </div>
                                 <button onClick={() => awayTeam && selectedMatchweek !== null && handlePickRequest(awayTeam.id, selectedMatchweek)} className="flex-1 flex flex-col items-center gap-2 hover:scale-105 transition-all">
                                    <img src={awayTeam?.logo} className="w-12 h-12 object-contain" alt={awayTeam?.name} />
                                    <span className="text-[11px] font-black text-white uppercase text-center">{match.awayTeam.name}</span>
                                 </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                             <i className="fa-solid fa-spinner animate-spin text-2xl mb-4"></i>
                             <p className="font-black uppercase italic tracking-widest text-xs">Awaiting Match Data...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : dataTab === 'TABLE' ? (
                    <div className="space-y-4">
                       <div className="grid grid-cols-12 text-[9px] font-black text-slate-600 uppercase tracking-widest px-4">
                          <span className="col-span-1">#</span>
                          <span className="col-span-5">Club</span>
                          <span className="col-span-2 text-center">P</span>
                          <span className="col-span-2 text-center">GD</span>
                          <span className="col-span-2 text-right">Pts</span>
                       </div>
                       {sortedTable.map((row, idx) => {
                          const teamObj = PREMIER_LEAGUE_TEAMS.find(t => t.name.toLowerCase() === row.team.toLowerCase() || t.aliases?.some(a => a.toLowerCase() === row.team.toLowerCase()));
                          return (
                            <div key={idx} className="grid grid-cols-12 items-center bg-black/20 p-4 rounded-2xl border border-white/5 text-[11px] font-black hover:border-indigo-500/50 transition-all shadow-md">
                               <span className="col-span-1 text-slate-500">{row.position}</span>
                               <div className="col-span-5 flex items-center gap-3">
                                  <img src={teamObj?.logo} className="w-5 h-5 object-contain" alt={row.team} />
                                  <span className="truncate text-white uppercase">{row.team}</span>
                               </div>
                               <span className="col-span-2 text-center text-slate-500">{row.played}</span>
                               <span className="col-span-2 text-center text-slate-400">{row.gd}</span>
                               <span className="col-span-2 text-right text-indigo-400">{row.points}</span>
                            </div>
                          );
                       })}
                    </div>
                  ) : (
                    <TeamFormTab formData={searchFormResult.form} isLoading={isFormLoading} sources={searchFormResult.sources} />
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
               <div className="bg-[#161b22]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tactical Entries</h2>
                    {myCouponsInComp.length < MAX_ENTRIES_PER_POOL && (
                      <button onClick={addEntry} className="text-[9px] font-black uppercase text-indigo-400 hover:text-white transition">+ New Life (10 <i className="fa-solid fa-coins"></i>)</button>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    {myCouponsInComp.map(c => (
                      <button key={c.id} onClick={() => setActiveCouponId(c.id)} className={`flex items-center justify-between px-6 py-4 rounded-2xl border-2 transition-all shadow-lg ${activeCouponId === c.id ? 'bg-indigo-600 border-indigo-400' : 'bg-black/20 border-white/5 text-slate-500'}`}>
                        <span className="text-[11px] font-black uppercase tracking-widest">{c.name}</span>
                        {c.status === 'ELIMINATED' ? <i className="fa-solid fa-skull text-rose-500"></i> : <i className="fa-solid fa-shield-halved text-emerald-500"></i>}
                      </button>
                    ))}
                  </div>
                </div>

                {safeActiveCoupon && selectedMatchweek !== null && (
                  <div className="bg-[#161b22]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl animate-fade-in">
                    <h2 className="text-xl font-black text-white uppercase italic mb-6">MW {selectedMatchweek} Pick Selection</h2>
                    <div className="grid grid-cols-4 gap-3">
                      {PREMIER_LEAGUE_TEAMS.map(team => {
                        const used = selectedMatchweek !== null && safeActiveCoupon.picks.some(p => p.teamId === team.id && p.week !== selectedMatchweek);
                        const isSelected = !!currentPickInView && currentPickInView.teamId === team.id;
                        return (
                          <button key={team.id} disabled={!!used} onClick={() => {
                            if (selectedMatchweek !== null) {
                              handlePickRequest(team.id, selectedMatchweek);
                            }
                          }} 
                            className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-400 scale-105' : used ? 'opacity-10 bg-black cursor-not-allowed' : 'bg-black/20 border-white/5 hover:border-indigo-500 shadow-md'}`}>
                            <img src={team.logo} className="w-8 h-8 object-contain mb-1" alt={team.shortName} />
                            <span className="text-[7px] font-black uppercase text-center text-slate-400">{team.shortName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          </div>
        ) : (
          <div className="bg-[#161b22]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-12 shadow-2xl overflow-x-auto no-scrollbar animate-fade-in">
             <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Season Leaderboard</h2>
                <button onClick={shareReport} className="px-6 py-3 bg-emerald-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-emerald-500 transition shadow-xl shadow-emerald-600/20">Broadcast Pool Report</button>
             </div>
             <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                   <tr className="border-b border-white/5 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      <th className="py-6">Manager Entry</th>
                      {standingsWeeks.map(mw => <th key={mw} className="text-center px-4">MW {mw}</th>)}
                      <th className="text-right">Campaign Status</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                   {allCouponsInComp.map(c => (
                      <tr key={c.id} className={`${c.status === 'ELIMINATED' ? 'opacity-30' : ''} transition-opacity`}>
                         <td className="py-6">
                            <span className="text-lg font-black text-white uppercase tracking-tight leading-none">{c.name}</span>
                            <div className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{c.ownerNickname}</div>
                         </td>
                         {standingsWeeks.map(mw => {
                            const pick = c.picks.find(p => p.week === mw);
                            const team = PREMIER_LEAGUE_TEAMS.find(t => t.id === pick?.teamId);
                            return (
                               <td key={mw} className="text-center px-4">
                                  {team ? <img src={team.logo} className="w-8 h-8 object-contain mx-auto transition-transform hover:scale-125" title={team.name} alt={team.name} /> : <span className="text-slate-800 text-xs">—</span>}
                               </td>
                            );
                         })}
                         <td className="text-right">
                            <span className={`px-4 py-2 text-[9px] font-black rounded-full border shadow-sm ${c.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>{c.status}</span>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}

        <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#161b22]/80 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-full flex items-center gap-4 shadow-2xl z-50">
          <button onClick={() => setActiveView('GAME')} className={`px-8 py-3 rounded-full text-[10px] font-black tracking-[0.2em] transition-all uppercase ${activeView === 'GAME' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>MATCHES</button>
          <button onClick={() => setActiveView('DASHBOARD')} className={`px-8 py-3 rounded-full text-[10px] font-black tracking-[0.2em] transition-all uppercase ${activeView === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>POOL</button>
        </nav>

        {pendingPick && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-[200] animate-fade-in backdrop-blur-md">
            <div className="bg-[#161b22] border border-[#30363d] w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Confirm Selection</h3>
              <img src={pendingPick.logo} className="w-24 h-24 object-contain mx-auto mb-6 drop-shadow-2xl" alt={pendingPick.teamName} />
              <h2 className="text-3xl font-black text-white uppercase italic mb-10 tracking-tighter">{pendingPick.teamName}</h2>
              <div className="flex flex-col gap-4">
                <button onClick={() => { 
                  if (activeCouponId !== null) {
                    setState(prev => ({ ...prev, coupons: prev.coupons.map(c => c.id === activeCouponId ? { ...c, picks: [...c.picks.filter(p => p.week !== pendingPick.week), { week: pendingPick.week, teamId: pendingPick.teamId }] } : c) })); 
                  }
                  setPendingPick(null); 
                }}
                   className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20">Lock In Pick</button>
                <button onClick={() => setPendingPick(null)} className="w-full py-2 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors">Abort Selection</button>
              </div>
            </div>
          </div>
        )}

        {showAdminHub && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-[200] animate-fade-in backdrop-blur-md">
            <div className="bg-[#161b22] border border-[#30363d] w-full max-w-2xl rounded-[3rem] p-12 text-center shadow-2xl">
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-8">Admin Control Engine</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <button onClick={() => { setShowAdminHub(false); setShowResolveModal(true); }} className="py-12 bg-indigo-600 text-white font-black rounded-3xl uppercase tracking-widest hover:bg-indigo-500 transition shadow-2xl shadow-indigo-600/30">Resolve Week {currentMatchweekLabel}</button>
                 <button onClick={() => window.location.reload()} className="py-12 bg-slate-800 text-white font-black rounded-3xl uppercase tracking-widest hover:bg-slate-700 transition shadow-inner">Sync Engine</button>
              </div>
              <button onClick={() => setShowAdminHub(false)} className="mt-10 text-slate-500 font-bold uppercase text-[11px] tracking-widest hover:text-white transition-colors">Shutdown Hub</button>
            </div>
          </div>
        )}

        {showResolveModal && (
          <div className="fixed inset-0 bg-black/98 z-[250] flex items-center justify-center p-6 overflow-y-auto animate-fade-in backdrop-blur-lg">
            <div className="bg-[#161b22] border border-[#30363d] w-full max-w-2xl rounded-[3rem] p-12 shadow-2xl">
              <h2 className="text-4xl font-black text-white uppercase italic mb-8 tracking-tighter">MW {currentMatchweekLabel} Final Scorecards</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                {PREMIER_LEAGUE_TEAMS.sort((a,b) => a.name.localeCompare(b.name)).map(team => {
                  const currentStatus = state.plData?.results?.[team.name] || 'PENDING';
                  return (
                    <div key={team.id} className="bg-black/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-inner">
                      <span className="text-[11px] font-black text-white uppercase truncate max-w-[120px] tracking-tight">{team.name}</span>
                      <div className="flex gap-1">
                        {(['WIN', 'DRAW', 'LOSS'] as TeamStatus[]).map(s => (
                          <button key={s} onClick={() => setState(prev => ({ ...prev, plData: prev.plData ? { ...prev.plData, results: { ...prev.plData.results, [team.name]: s } } : null }))}
                            className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${currentStatus === s ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-950 text-slate-700'}`}>{s.charAt(0)}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4">
                <button onClick={resolveWeek} className="flex-1 py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-indigo-600/20">Authorize Results</button>
                <button onClick={() => setShowResolveModal(false)} className="px-8 py-5 bg-slate-800 text-slate-500 font-black rounded-2xl uppercase tracking-widest hover:text-white transition">Abort</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;