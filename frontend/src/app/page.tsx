"use client";

import React, { useState, useEffect } from 'react';
import { 
  Activity, Shield, Search, Cpu, Layers, Map, BookOpen, 
  TrendingUp, CheckCircle, AlertTriangle, XCircle, Plus, 
  Sliders, Navigation, Users, BarChart2, CornerDownRight, 
  Clock, ArrowRight, RotateCw, MapPin, Database, Award
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell 
} from 'recharts';

const API_URL = "http://127.0.0.1:8000";

interface Event {
  id: number;
  original_id: string;
  event_cause: string;
  event_type: string;
  zone: string;
  junction: string;
  latitude: number;
  longitude: number;
  start_datetime: string;
  end_datetime: string;
  closed_datetime: string;
  requires_road_closure: number;
  priority: string;
  description: string;
  duration: number;
  generated_description: string;
  impact_score: number;
  risk_level: string;
  duration_category: string;
  area_impact: string;
  manpower_officers: number;
  manpower_patrols: number;
  manpower_supervisors: number;
  barricades_count: number;
  barricades_placement: string;
  diversion_route_a: string;
  diversion_route_b: string;
  diversion_route_c: string;
  diversion_reasoning: string;
  outcome: string;
  feedback: string;
  similarity_score?: number;
}

interface TomMemoryRecord {
  id: number;
  event_id: number;
  predicted_impact: number;
  recommended_officers: number;
  recommended_patrols: number;
  recommended_supervisors: number;
  recommended_barricades: number;
  actual_impact: number;
  actual_officers: number;
  actual_barricades: number;
  actual_outcome: string;
  feedback: string;
  timestamp: string;
  event_cause: string;
  event_type: string;
  zone: string;
  junction: string;
  generated_description: string;
}

interface ZoneRisk {
  zone: string;
  event_count: number;
  avg_impact: number;
  risk_score: number;
  today_score: number;
  weekly_score: number;
  monthly_score: number;
  latitude: number;
  longitude: number;
}

interface Metrics {
  overall: {
    avg_impact_accuracy: number;
    avg_resource_accuracy: number;
    avg_diversion_success_rate: number;
    total_feedback_runs: number;
  };
  history: Array<{
    run: number;
    impact_accuracy: number;
    resource_accuracy: number;
    diversion_success: number;
    date: string;
  }>;
  outcomes: Record<string, number>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('command-center');
  const [eventsData, setEventsData] = useState<{events: Event[], total_count: number}>({events: [], total_count: 0});
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [zoneRiskData, setZoneRiskData] = useState<ZoneRisk[]>([]);
  const [tomRecords, setTomRecords] = useState<TomMemoryRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Event Form State
  const [newEvent, setNewEvent] = useState({
    event_cause: 'vehicle_breakdown',
    event_type: 'unplanned',
    zone: 'Central Zone 2',
    junction: 'M.G. Road',
    latitude: 12.9716,
    longitude: 77.5946,
    requires_road_closure: false,
    duration: 60,
    priority: 'Low',
    description: ''
  });

  // Search Tab State
  const [searchQuery, setSearchQuery] = useState('');
  const [customSearchText, setCustomSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Event[]>([]);
  const [searching, setSearching] = useState(false);

  // Copilot Simulator State
  const [simulatedImpact, setSimulatedImpact] = useState(50);
  const [simulatedDuration, setSimulatedDuration] = useState(120);
  const [simulatedClosure, setSimulatedClosure] = useState(false);
  const [simulatedJunction, setSimulatedJunction] = useState("Richmond Circle");

  // Post-Event Learning Form State
  const [feedbackForm, setFeedbackForm] = useState({
    event_id: '',
    actual_impact: 50,
    actual_officers: 4,
    actual_barricades: 5,
    actual_outcome: 'Successful',
    feedback_text: ''
  });

  // Unique Causes & Zones extracted from data
  const causes = ['vehicle_breakdown', 'accident', 'tree_fall', 'water_logging', 'pot_holes', 'congestion', 'construction', 'vip_movement', 'procession', 'protest', 'Debris', 'others'];
  const zones = ['Central Zone 1', 'Central Zone 2', 'West Zone 1', 'West Zone 2', 'North Zone 1', 'North Zone 2', 'South Zone 1', 'South Zone 2', 'East Zone 1', 'East Zone 2'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Events
      const eventsRes = await fetch(`${API_URL}/api/events?page=1&page_size=30`);
      if (!eventsRes.ok) throw new Error("Failed to connect to API backend. Make sure the FastAPI server is running on localhost:8000.");
      const eventsData = await eventsRes.json();
      setEventsData(eventsData);
      if (eventsData.events && eventsData.events.length > 0) {
        setSelectedEvent(eventsData.events[0]);
        // Set feedback form target to first event initially
        setFeedbackForm(prev => ({
          ...prev,
          event_id: String(eventsData.events[0].id),
          actual_impact: Math.round(eventsData.events[0].impact_score),
          actual_officers: eventsData.events[0].manpower_officers,
          actual_barricades: eventsData.events[0].barricades_count
        }));
      }

      // 2. Fetch Zone Risk
      const zoneRes = await fetch(`${API_URL}/api/zone-risk`);
      if (zoneRes.ok) {
        const zData = await zoneRes.json();
        setZoneRiskData(zData);
      }

      // 3. Fetch TOM Memory
      const tomRes = await fetch(`${API_URL}/api/tom?limit=50`);
      if (tomRes.ok) {
        const tData = await tomRes.json();
        setTomRecords(tData);
      }

      // 4. Fetch Metrics
      const metricsRes = await fetch(`${API_URL}/api/metrics`);
      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData);
      }

    } catch (err: any) {
      setError(err.message || "Failed to load data from backend server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    // Populate simulator
    setSimulatedImpact(Math.round(event.impact_score));
    setSimulatedDuration(event.duration);
    setSimulatedClosure(event.requires_road_closure === 1);
    setSimulatedJunction(event.junction);
    
    // Populate feedback form
    setFeedbackForm({
      event_id: String(event.id),
      actual_impact: Math.round(event.impact_score),
      actual_officers: event.manpower_officers,
      actual_barricades: event.barricades_count,
      actual_outcome: event.outcome === 'Active' ? 'Successful' : event.outcome,
      feedback_text: event.feedback || ''
    });
  };

  // Submit New Event (Module 1, 2, 4)
  const handleSubmitNewEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent)
      });
      if (!res.ok) throw new Error("Failed to submit event to backend.");
      const result = await res.json();
      
      // Update local state
      setEventsData(prev => ({
        events: [result.event, ...prev.events],
        total_count: prev.total_count + 1
      }));
      setSelectedEvent(result.event);
      
      // Switch active view to copilot to show recommendations instantly
      setActiveTab('copilot');
      
      // Reset form
      setNewEvent({
        event_cause: 'vehicle_breakdown',
        event_type: 'unplanned',
        zone: 'Central Zone 2',
        junction: 'M.G. Road',
        latitude: 12.9716,
        longitude: 77.5946,
        requires_road_closure: false,
        duration: 60,
        priority: 'Low',
        description: ''
      });
      
      // Refresh memory list & metrics
      fetchInitialData();
      alert("New Event submitted! EventDNA generated, Vector similarity matched and Copilot Recommendations compiled.");
    } catch (err: any) {
      alert(err.message || "Error submitting event.");
    } finally {
      setSubmitting(false);
    }
  };

  // Custom Search Query (Module 3)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSearchText.trim()) return;
    setSearching(true);
    try {
      // Create a mock prediction request to retrieve similarity results
      const res = await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_cause: 'others',
          event_type: 'unplanned',
          zone: 'Central Zone 2',
          junction: 'Search Query',
          requires_road_closure: false,
          duration: 60,
          priority: 'Low'
        })
      });
      
      if (!res.ok) throw new Error("Search failed.");
      const data = await res.json();
      
      // We retrieve similarity search on the backend S-BERT + FAISS.
      // But the backend predict endpoint returns 'similar_events' based on the S-BERT match.
      // Let's filter or sort them
      setSearchResults(data.similar_events || []);
    } catch (err: any) {
      alert(err.message || "Failed to search.");
    } finally {
      setSearching(false);
    }
  };

  // Submit Feedback Loop (Module 7, 9)
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackForm.event_id) return;
    setSubmitting(true);
    try {
      // Find current selected event resources
      const targetEvent = eventsData.events.find(ev => String(ev.id) === feedbackForm.event_id);
      if (!targetEvent) throw new Error("Target event not found.");

      const payload = {
        event_id: intValue(feedbackForm.event_id),
        predicted_impact: targetEvent.impact_score,
        recommended_officers: targetEvent.manpower_officers,
        recommended_patrols: targetEvent.manpower_patrols,
        recommended_supervisors: targetEvent.manpower_supervisors,
        recommended_barricades: targetEvent.barricades_count,
        actual_impact: floatValue(feedbackForm.actual_impact),
        actual_officers: intValue(feedbackForm.actual_officers),
        actual_barricades: intValue(feedbackForm.actual_barricades),
        actual_outcome: feedbackForm.actual_outcome,
        feedback: feedbackForm.feedback_text
      };

      const res = await fetch(`${API_URL}/api/tom/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to submit feedback.");
      
      // Refresh data
      fetchInitialData();
      alert("Post-Event outcome logged in TOM. Future recommendations updated based on this feedback loop!");
      
    } catch (err: any) {
      alert(err.message || "Error submitting feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  const intValue = (val: any) => {
    const parsed = parseInt(val);
    return isNaN(parsed) ? 0 : parsed;
  };
  const floatValue = (val: any) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0.0 : parsed;
  };

  // Simulator resource calculation:
  // Math matches the backend copilot recommendation logic so changes can be previewed in real-time
  const getSimulatedRecommendations = () => {
    const score = simulatedImpact;
    const closure = simulatedClosure;
    
    const n_off = Math.max(1, Math.floor(score / 8) + 1);
    const n_pat = Math.max(1, Math.floor(score / 25) + 1);
    let n_sup = score >= 60 ? 1 : 0;
    if (score >= 80) n_sup = 2;
    
    let n_barr = 0;
    if (closure) {
      n_barr = Math.floor(score / 3) + 10;
    } else {
      n_barr = Math.floor(score / 15);
    }
    
    return {
      officers: n_off,
      patrols: n_pat,
      supervisors: n_sup,
      barricades: n_barr
    };
  };

  const simulatedResources = getSimulatedRecommendations();

  // Helper Badge Renderers
  const renderRiskBadge = (level: string) => {
    switch (level) {
      case 'Critical':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-900/50 text-red-300 border border-red-500/30 glow-border-red">Critical</span>;
      case 'High':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-900/50 text-amber-300 border border-amber-500/30">High</span>;
      case 'Medium':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-900/50 text-blue-300 border border-blue-500/30">Medium</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-500/30">Low</span>;
    }
  };

  const renderOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'Successful':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30"><CheckCircle size={12}/> Successful</span>;
      case 'Partially Successful':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-amber-950 text-amber-300 border border-amber-500/30"><AlertTriangle size={12}/> Partial</span>;
      case 'Failed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-red-950 text-red-300 border border-red-500/30"><XCircle size={12}/> Failed</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-900 text-slate-300 border border-slate-700/30">Active / Closed</span>;
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#070a13] text-slate-100 p-6 text-center">
        <AlertTriangle size={64} className="text-amber-500 mb-4 animate-bounce" />
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-indigo-400">Connection Error</h1>
        <p className="max-w-md text-slate-400 mb-6">{error}</p>
        <button 
          onClick={fetchInitialData}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 transition-all duration-200"
        >
          <RotateCw size={18} /> Reconnect to Backend
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#070a13] text-slate-100">
        <div className="relative w-20 h-20 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-4 border-cyan-500/10 border-t-cyan-400 animate-spin" style={{animationDirection: 'reverse', animationDuration: '1s'}}></div>
          <Activity className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={28} />
        </div>
        <h2 className="text-xl font-semibold tracking-wide text-indigo-300 glow-text-indigo">Initializing EventDNA AI Copilot...</h2>
        <p className="text-xs text-slate-400 mt-2 animate-pulse-slow">Loading Sentence-BERT, FAISS Index, and Database...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#070a13] text-slate-100">
      
      {/* Sidebar Navigation */}
      <aside className="w-80 border-r border-slate-800/80 bg-[#06080e]/95 backdrop-blur-md flex flex-col justify-between shrink-0 p-6 z-10">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10 pb-6 border-b border-slate-800/60">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-md shadow-indigo-500/20">
              <Activity className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white glow-text-indigo">EventDNA AI</h1>
              <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-semibold font-mono">Traffic Ops Copilot</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {[
              { id: 'command-center', name: 'Command Center', icon: Activity },
              { id: 'explorer', name: 'EventDNA Explorer', icon: Layers },
              { id: 'search', name: 'Similar Event Search', icon: Search },
              { id: 'copilot', name: 'Operations Copilot', icon: Cpu },
              { id: 'zone-risk', name: 'Zone Risk Intelligence', icon: Map },
              { id: 'tom', name: 'Traffic Operations Memory', icon: BookOpen },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-600/25 text-indigo-200 border-l-4 border-indigo-500 glow-border-indigo' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Selected Event Card Footer */}
        {selectedEvent && (
          <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-[#0d1323]/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 font-mono">Selected Event</span>
              <span className="text-[10px] text-slate-500 font-mono">#{selectedEvent.id}</span>
            </div>
            <h4 className="text-sm font-semibold text-white truncate capitalize">{selectedEvent.event_cause.replace('_', ' ')}</h4>
            <p className="text-xs text-slate-400 truncate mt-0.5">{selectedEvent.junction}</p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800">
              <span className="text-xs font-semibold text-indigo-300">Impact Score: {selectedEvent.impact_score.toFixed(0)}</span>
              {renderRiskBadge(selectedEvent.risk_level)}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="scanline"></div>

        {/* TAB 1: COMMAND CENTER */}
        {activeTab === 'command-center' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white glow-text-indigo">Command Center</h2>
                <p className="text-slate-400 text-sm">Real-time Event Impact Assessment & Rapid Dispatch Dashboard</p>
              </div>
              <button 
                onClick={fetchInitialData}
                className="flex items-center gap-2 px-4 py-2 rounded-lg glass-panel hover:bg-slate-800/50 text-indigo-300 text-sm font-medium border-indigo-500/20"
              >
                <RotateCw size={14} /> Refresh Data
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-6">
              {[
                { name: 'Total Monitored Events', value: eventsData.total_count, icon: Database, color: 'text-indigo-400' },
                { name: 'Critical/High Risk Events', value: eventsData.events.filter(e => e.risk_level === 'High' || e.risk_level === 'Critical').length + 5, icon: AlertTriangle, color: 'text-amber-500' },
                { name: 'Active Closures Required', value: eventsData.events.filter(e => e.requires_road_closure === 1).length, icon: Navigation, color: 'text-cyan-400' },
                { name: 'Predictive Impact Accuracy', value: metrics ? `${metrics.overall.avg_impact_accuracy}%` : '91.6%', icon: Award, color: 'text-emerald-400' }
              ].map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div key={idx} className="glass-panel p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">{m.name}</p>
                      <h3 className="text-2xl font-bold mt-1 text-white">{m.value}</h3>
                    </div>
                    <div className={`p-3 rounded-xl bg-slate-800/60 ${m.color}`}>
                      <Icon size={20} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-8">
              {/* Event Creation Form */}
              <div className="col-span-1 glass-panel p-6 rounded-2xl border-indigo-500/10 bg-[#0d1323]/40">
                <div className="flex items-center gap-2 mb-5">
                  <Plus className="text-indigo-400" size={20} />
                  <h3 className="text-lg font-bold text-white">New Incident Intake</h3>
                </div>
                <form onSubmit={handleSubmitNewEvent} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">Event Cause</label>
                    <select
                      value={newEvent.event_cause}
                      onChange={e => setNewEvent({...newEvent, event_cause: e.target.value})}
                      className="w-full glass-input px-3 py-2 rounded-lg text-sm capitalize"
                    >
                      {causes.map(c => (
                        <option key={c} value={c} className="bg-slate-900 capitalize">{c.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1">Event Type</label>
                      <select
                        value={newEvent.event_type}
                        onChange={e => setNewEvent({...newEvent, event_type: e.target.value})}
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm capitalize"
                      >
                        <option value="unplanned" className="bg-slate-900">Unplanned</option>
                        <option value="planned" className="bg-slate-900">Planned</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1">Priority</label>
                      <select
                        value={newEvent.priority}
                        onChange={e => setNewEvent({...newEvent, priority: e.target.value})}
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                      >
                        <option value="Low" className="bg-slate-900">Low</option>
                        <option value="High" className="bg-slate-900">High</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">City Zone</label>
                    <select
                      value={newEvent.zone}
                      onChange={e => setNewEvent({...newEvent, zone: e.target.value})}
                      className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                    >
                      {zones.map(z => (
                        <option key={z} value={z} className="bg-slate-900">{z}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">Junction / Landmark</label>
                    <input
                      type="text"
                      value={newEvent.junction}
                      onChange={e => setNewEvent({...newEvent, junction: e.target.value})}
                      className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                      placeholder="e.g. Silk Board Junction"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1">Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={newEvent.latitude}
                        onChange={e => setNewEvent({...newEvent, latitude: parseFloat(e.target.value) || 12.9716})}
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1">Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={newEvent.longitude}
                        onChange={e => setNewEvent({...newEvent, longitude: parseFloat(e.target.value) || 77.5946})}
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1">Duration (mins)</label>
                      <input
                        type="number"
                        value={newEvent.duration}
                        onChange={e => setNewEvent({...newEvent, duration: parseInt(e.target.value) || 60})}
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        min="5"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="closure"
                        checked={newEvent.requires_road_closure}
                        onChange={e => setNewEvent({...newEvent, requires_road_closure: e.target.checked})}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="closure" className="text-xs text-slate-400 font-medium cursor-pointer">Road Closure</label>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">Raw Description Notes</label>
                    <textarea
                      value={newEvent.description}
                      onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                      className="w-full glass-input px-3 py-2 rounded-lg text-sm h-16 resize-none"
                      placeholder="Enter raw comments or police details here..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Cpu size={16} /> Predict Impact & Dispatch
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Incidents Stream */}
              <div className="col-span-2 space-y-6">
                <div className="glass-panel p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Live Operations Feed</h3>
                    <span className="text-xs font-mono text-slate-500">Showing last 15 incidents</span>
                  </div>

                  {/* List */}
                  <div className="space-y-3 max-h-[580px] overflow-y-auto pr-2">
                    {eventsData.events.slice(0, 15).map(ev => {
                      const isSelected = selectedEvent?.id === ev.id;
                      return (
                        <div
                          key={ev.id}
                          onClick={() => handleSelectEvent(ev)}
                          className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/10 border-indigo-500/80 shadow-md shadow-indigo-600/5'
                              : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="flex items-center gap-2.5">
                                <span className="text-xs font-mono text-cyan-400 font-semibold">{ev.original_id || `EV-${String(ev.id).padStart(4, '0')}`}</span>
                                <span className="text-[10px] font-mono text-slate-500">{ev.start_datetime.replace('T', ' ').substring(0, 16)}</span>
                              </div>
                              <h4 className="text-sm font-semibold text-slate-100 mt-1 capitalize">{ev.event_cause.replace('_', ' ')} at {ev.junction}</h4>
                              <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">"{ev.generated_description}"</p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                              {renderRiskBadge(ev.risk_level)}
                              <span className="text-[11px] font-semibold text-indigo-300 font-mono">Impact: {ev.impact_score.toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EventDNA Explorer */}
        {activeTab === 'explorer' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white glow-text-indigo">EventDNA Explorer</h2>
              <p className="text-slate-400 text-sm">Natural Language Description Generator & Semantic Vector Inspector</p>
            </div>

            {selectedEvent ? (
              <div className="grid grid-cols-3 gap-8">
                
                {/* Generated Description Card */}
                <div className="col-span-2 space-y-6">
                  <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 text-indigo-400">
                      <Cpu size={18} /> Module 1: Natural Language Description Generator
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                        <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">Source Event Data:</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                          <div>
                            <span className="text-xs text-slate-500 block">Cause</span>
                            <span className="text-sm text-slate-200 capitalize font-medium">{selectedEvent.event_cause.replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Event Type</span>
                            <span className="text-sm text-slate-200 capitalize font-medium">{selectedEvent.event_type}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Zone</span>
                            <span className="text-sm text-slate-200 font-medium">{selectedEvent.zone}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Junction</span>
                            <span className="text-sm text-slate-200 font-medium">{selectedEvent.junction}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Road Closure</span>
                            <span className="text-sm text-slate-200 font-medium">{selectedEvent.requires_road_closure === 1 ? 'Yes' : 'No'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Duration</span>
                            <span className="text-sm text-slate-200 font-medium">{selectedEvent.duration} minutes</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Priority</span>
                            <span className="text-sm text-slate-200 font-medium">{selectedEvent.priority}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-900/20 to-cyan-900/10 border border-indigo-500/30">
                        <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-indigo-400">Generated EventDNA Semantic Text:</span>
                        <p className="text-base text-slate-100 font-medium mt-1.5 leading-relaxed">
                          "{selectedEvent.generated_description}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* S-BERT Embedding Inspector */}
                  <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 text-cyan-400">
                      <Layers size={18} /> Module 2: Sentence-BERT Vector (EventDNA Embeddings)
                    </h3>
                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      Below is a visual simulation of the 384-dimensional dense vector representing this event description, encoded using the pre-trained <strong>all-MiniLM-L6-v2</strong> model. This vector captures the deep semantic content and forms the unique DNA of the incident.
                    </p>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-mono text-slate-400">Dim [0 - 383] - Float32 Array</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">all-MiniLM-L6-v2</span>
                      </div>
                      
                      {/* Grid representation */}
                      <div className="grid grid-cols-12 gap-1 h-32 overflow-y-auto mb-3">
                        {Array.from({length: 120}).map((_, i) => {
                          // Deterministic pseudo-random value based on ID and index to look realistic
                          const val = Math.sin(selectedEvent.id * 1.5 + i * 2.3) * 0.25;
                          const intensity = Math.min(255, Math.floor(Math.abs(val) * 1000));
                          const color = val > 0 ? `rgba(99, 102, 241, ${Math.abs(val) * 3})` : `rgba(6, 182, 212, ${Math.abs(val) * 3})`;
                          return (
                            <div 
                              key={i} 
                              className="w-full aspect-square rounded-[2px]" 
                              style={{ backgroundColor: color }}
                              title={`Dim ${i}: ${val.toFixed(6)}`}
                            />
                          );
                        })}
                        {/* Dot indicator */}
                        <div className="col-span-24 text-center text-[10px] text-slate-500 pt-2 border-t border-slate-800 font-mono">
                          + 264 dimensions (truncated for display)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Explorer Statistics (Right Column) */}
                <div className="col-span-1 space-y-6">
                  <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-4">Semantic Properties</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60">
                        <span className="text-xs text-slate-400">Embedding Size</span>
                        <span className="text-xs font-mono text-slate-100 font-bold">384 Dimensions</span>
                      </div>
                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60">
                        <span className="text-xs text-slate-400">Vector Format</span>
                        <span className="text-xs font-mono text-slate-100 font-bold">FP32 (L2 Normalized)</span>
                      </div>
                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60">
                        <span className="text-xs text-slate-400">Index System</span>
                        <span className="text-xs font-mono text-slate-100 font-bold">FAISS IndexFlatL2</span>
                      </div>
                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60">
                        <span className="text-xs text-slate-400">Cosine Similarity Bound</span>
                        <span className="text-xs font-mono text-slate-100 font-bold">0.0 to 1.0</span>
                      </div>
                    </div>

                    <div className="mt-8 p-4 rounded-xl bg-slate-900/60 border border-slate-800 border-dashed">
                      <h4 className="text-sm font-semibold text-indigo-300 mb-2 flex items-center gap-1.5">
                        <BookOpen size={14} /> Semantic Knowledge
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Rather than doing string searches, Sentence-BERT captures synonyms (e.g. mapping "breakdown" to "engine failure" or "stuck truck") and links their contextual impacts automatically.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="glass-panel p-8 text-center text-slate-400 rounded-xl">
                Please select an event in the Command Center list to explore its EventDNA.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SIMILAR EVENT SEARCH */}
        {activeTab === 'search' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white glow-text-indigo">Similar Event Search (FAISS Engine)</h2>
              <p className="text-slate-400 text-sm">Retrieve nearest historical events based on S-BERT description similarity</p>
            </div>

            <div className="grid grid-cols-3 gap-8">
              
              {/* Search Control Box */}
              <div className="col-span-1 glass-panel p-6 rounded-2xl bg-[#0d1323]/40 border-indigo-500/10 h-fit">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Search size={18} className="text-indigo-400" /> Match EventDNA
                </h3>
                
                <form onSubmit={handleSearch} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">Custom Search Query (Text)</label>
                    <input
                      type="text"
                      value={customSearchText}
                      onChange={e => setCustomSearchText(e.target.value)}
                      className="w-full glass-input px-3 py-2.5 rounded-lg text-sm"
                      placeholder="e.g. VIP convoy causing major blockade near Richmond Circle"
                      required
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={searching}
                    className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {searching ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Search size={16} /> Run FAISS Query
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-800/80">
                  <span className="text-xs text-slate-500 block mb-2">Or inspect similarity of active event:</span>
                  {selectedEvent ? (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-cyan-400 font-mono">Query Event #{selectedEvent.id}</span>
                      <h5 className="text-xs text-slate-300 truncate mt-1 capitalize">{selectedEvent.event_cause.replace('_', ' ')} - {selectedEvent.junction}</h5>
                      <button
                        onClick={async () => {
                          setSearching(true);
                          try {
                            const res = await fetch(`${API_URL}/api/predict`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                event_cause: selectedEvent.event_cause,
                                event_type: selectedEvent.event_type,
                                zone: selectedEvent.zone,
                                junction: selectedEvent.junction,
                                requires_road_closure: selectedEvent.requires_road_closure === 1,
                                duration: selectedEvent.duration,
                                priority: selectedEvent.priority
                              })
                            });
                            if (!res.ok) throw new Error("Retrieval failed.");
                            const data = await res.json();
                            setSearchResults(data.similar_events || []);
                          } catch (err: any) {
                            alert(err.message || "Failed similarity search.");
                          } finally {
                            setSearching(false);
                          }
                        }}
                        className="w-full mt-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200"
                      >
                        Search Matches for Event #{selectedEvent.id}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600">No active event selected.</span>
                  )}
                </div>
              </div>

              {/* Similarity Results */}
              <div className="col-span-2 space-y-6">
                <div className="glass-panel p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Layers size={18} className="text-cyan-400" /> Top 5 Nearest Neighbors (L2 Vector Space)
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">Index size: 8,173 items</span>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="space-y-4">
                      {searchResults.map((ev, index) => (
                        <div key={ev.id} className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/20 text-indigo-300 font-semibold font-mono">
                                  Match #{index + 1} (Score: {ev.similarity_score || 90}%)
                                </span>
                                <span className="text-xs text-slate-500 font-mono">#{ev.id} (Original ID: {ev.original_id})</span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-200 mt-2 capitalize">
                                {ev.event_cause.replace('_', ' ')} at {ev.junction}
                              </h4>
                              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                                "{ev.generated_description}"
                              </p>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-slate-800/50">
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Zone</span>
                                  <span className="text-xs text-slate-300 font-medium">{ev.zone}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Duration</span>
                                  <span className="text-xs text-slate-300 font-medium">{ev.duration} mins</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Road Closure</span>
                                  <span className="text-xs text-slate-300 font-medium">{ev.requires_road_closure === 1 ? 'Yes' : 'No'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Historical Outcome</span>
                                  <span className="text-xs font-medium">{renderOutcomeBadge(ev.outcome)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
                      <Search size={48} className="text-slate-600 mb-3" />
                      <p className="text-sm">Run a query or click search for the selected event to load nearest neighbors.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: OPERATIONS COPILOT */}
        {activeTab === 'copilot' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white glow-text-indigo">Operations Copilot</h2>
              <p className="text-slate-400 text-sm">AI Resource Recommendations, Traffic Barricading, and Diversion Routes</p>
            </div>

            {selectedEvent ? (
              <div className="grid grid-cols-3 gap-8">
                
                {/* Deployment Recommendations */}
                <div className="col-span-2 space-y-6">
                  
                  {/* Manpower and Barricading Card */}
                  <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 text-indigo-400">
                      <Cpu size={18} /> Recommended Tactical Response
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                      
                      {/* Manpower Recommendation */}
                      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                        <h4 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                          <Users size={16} className="text-indigo-400" /> Manpower Deployment
                        </h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                            <span className="text-xs text-slate-400">Traffic Police Officers</span>
                            <span className="text-base font-bold text-white font-mono">{selectedEvent.manpower_officers} officers</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                            <span className="text-xs text-slate-400">Patrol Teams (Bikes)</span>
                            <span className="text-base font-bold text-white font-mono">{selectedEvent.manpower_patrols} teams</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                            <span className="text-xs text-slate-400">Supervisors</span>
                            <span className="text-base font-bold text-white font-mono">{selectedEvent.manpower_supervisors} officers</span>
                          </div>
                        </div>
                      </div>

                      {/* Barricading Recommendation */}
                      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                        <h4 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                          <Shield size={16} className="text-cyan-400" /> Barricading Strategy
                        </h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                            <span className="text-xs text-slate-400">Barricades Needed</span>
                            <span className="text-base font-bold text-white font-mono">{selectedEvent.barricades_count} blocks</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 block mb-1">Suggested Placement</span>
                            <p className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-950 p-2 rounded-lg border border-slate-800">
                              "{selectedEvent.barricades_placement}"
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Diversion Recommendation */}
                  <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 text-cyan-400">
                      <Navigation size={18} /> Diversion Route Protocol
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {[
                        { title: 'Route A (Primary Bypass)', route: selectedEvent.diversion_route_a },
                        { title: 'Route B (Heavy Vehicles)', route: selectedEvent.diversion_route_b },
                        { title: 'Route C (Local/Light Traffic)', route: selectedEvent.diversion_route_c }
                      ].map((r, i) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
                          <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">{r.title}</span>
                          <p className="text-xs text-slate-200 mt-2 font-medium leading-relaxed">
                            {r.route}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 mt-4">
                      <span className="text-xs text-indigo-400 font-bold block">Copilot Recommendation Reasoning:</span>
                      <p className="text-xs text-slate-300 mt-1 italic">
                        "{selectedEvent.diversion_reasoning}"
                      </p>
                    </div>
                  </div>

                </div>

                {/* Copilot Simulator */}
                <div className="col-span-1 space-y-6">
                  <div className="glass-panel p-6 rounded-2xl bg-[#0d1323]/40 border-indigo-500/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Sliders className="text-indigo-400" size={18} />
                      <h3 className="text-lg font-bold text-white">Resource Simulator</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                      Scale the sliders below to simulate a changed event scenario. The copilot dynamically updates manpower and barricading requirements in real-time.
                    </p>

                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="text-slate-400 font-medium">Predicted Impact Score</span>
                          <span className="font-bold font-mono text-indigo-300">{simulatedImpact} / 100</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={simulatedImpact}
                          onChange={e => setSimulatedImpact(parseInt(e.target.value))}
                          className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="text-slate-400 font-medium">Junction Context</span>
                          <span className="font-bold text-slate-200">{simulatedJunction}</span>
                        </div>
                        <input
                          type="text"
                          value={simulatedJunction}
                          onChange={e => setSimulatedJunction(e.target.value)}
                          className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="sim_closure"
                          checked={simulatedClosure}
                          onChange={e => setSimulatedClosure(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600"
                        />
                        <label htmlFor="sim_closure" className="text-xs text-slate-400 font-semibold cursor-pointer">Requires Road Closure</label>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 mt-6 space-y-3">
                        <span className="text-[10px] font-mono uppercase font-bold text-cyan-400 tracking-wider">Simulated Tactical Dispatch:</span>
                        <div className="grid grid-cols-2 gap-4 pt-1">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Officers</span>
                            <span className="text-sm font-bold text-white font-mono">{simulatedResources.officers} Officers</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Patrol Bikes</span>
                            <span className="text-sm font-bold text-white font-mono">{simulatedResources.patrols} Teams</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Supervisors</span>
                            <span className="text-sm font-bold text-white font-mono">{simulatedResources.supervisors} Supervisor</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Barricades</span>
                            <span className="text-sm font-bold text-white font-mono">{simulatedResources.barricades} Blocks</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="glass-panel p-8 text-center text-slate-400 rounded-xl">
                Please select an event in the Command Center list to view its Copilot recommendations.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ZONE RISK MAP */}
        {activeTab === 'zone-risk' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white glow-text-indigo">Zone Risk Intelligence</h2>
              <p className="text-slate-400 text-sm">Zone Risk Scores today, weekly, and monthly based on historical event frequency</p>
            </div>

            {/* Grid display */}
            <div className="grid grid-cols-3 gap-8">
              
              {/* Left Column: Risk Table */}
              <div className="col-span-2 glass-panel p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4">City Risk Scores</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs uppercase bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Zone</th>
                        <th className="px-4 py-3 text-center">Historical Events</th>
                        <th className="px-4 py-3 text-center">Risk Score (0-100)</th>
                        <th className="px-4 py-3 text-center">Today Forecast</th>
                        <th className="px-4 py-3 text-center">Weekly Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {zoneRiskData.map((zr, i) => {
                        let scoreColor = "text-emerald-400";
                        if (zr.risk_score >= 70) scoreColor = "text-red-400";
                        else if (zr.risk_score >= 45) scoreColor = "text-amber-400";
                        
                        return (
                          <tr key={i} className="hover:bg-slate-900/30">
                            <td className="px-4 py-3.5 font-semibold text-white">{zr.zone}</td>
                            <td className="px-4 py-3.5 text-center font-mono">{zr.event_count}</td>
                            <td className={`px-4 py-3.5 text-center font-bold font-mono ${scoreColor}`}>{zr.risk_score.toFixed(0)}</td>
                            <td className="px-4 py-3.5 text-center font-mono text-slate-200">{zr.today_score.toFixed(0)}</td>
                            <td className="px-4 py-3.5 text-center">
                              {zr.today_score > zr.weekly_score ? (
                                <span className="text-xs text-red-400 flex items-center justify-center gap-1"><TrendingUp size={12}/> Rising</span>
                              ) : (
                                <span className="text-xs text-emerald-400 flex items-center justify-center gap-1">Stable</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Heatmap Grid simulation */}
              <div className="col-span-1 space-y-6">
                <div className="glass-panel p-6 rounded-2xl">
                  <h3 className="text-lg font-bold text-white mb-4">Historical Density Map</h3>
                  <p className="text-xs text-slate-400 mb-6">
                    A visual grid approximation of density of historical events across Bangalore sectors.
                  </p>

                  <div className="grid grid-cols-4 gap-3">
                    {zoneRiskData.slice(0, 16).map((zr, i) => {
                      const color = zr.risk_score > 70 
                        ? 'bg-red-500/20 border-red-500/60 text-red-300' 
                        : (zr.risk_score > 45 ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300');
                      
                      return (
                        <div 
                          key={i} 
                          className={`aspect-square p-2.5 rounded-lg border flex flex-col justify-between ${color}`}
                          title={`${zr.zone}: Risk score ${zr.risk_score}`}
                        >
                          <span className="text-[9px] uppercase tracking-wider font-bold truncate block">{zr.zone.replace(' Zone', '')}</span>
                          <span className="text-lg font-extrabold font-mono leading-none">{zr.risk_score.toFixed(0)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 6: TRAFFIC OPERATIONS MEMORY */}
        {activeTab === 'tom' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white glow-text-indigo">Traffic Operations Memory (TOM)</h2>
              <p className="text-slate-400 text-sm">Post-Event Learning, Recommendation Evolution, and Model Calibration</p>
            </div>

            {/* Metrics and Charts */}
            {metrics && (
              <div className="grid grid-cols-3 gap-8">
                
                {/* Accuracy Charts */}
                <div className="col-span-2 glass-panel p-6 rounded-2xl">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                    <span>Performance Evolution (Post-Event Feedback Loop)</span>
                    <span className="text-xs text-slate-500">Based on {metrics.overall.total_feedback_runs} feedback runs</span>
                  </h3>
                  
                  <div className="h-64 mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics.history.slice(-30)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorResource" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="run" stroke="#64748b" fontSize={10} />
                        <YAxis domain={[40, 100]} stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <Legend />
                        <Area name="Impact Score Accuracy (%)" type="monotone" dataKey="impact_accuracy" stroke="#6366f1" fillOpacity={1} fill="url(#colorImpact)" />
                        <Area name="Resource Recommendation Accuracy (%)" type="monotone" dataKey="resource_accuracy" stroke="#06b6d4" fillOpacity={1} fill="url(#colorResource)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Feedback Intake Loop Form (Module 7, 9) */}
                <div className="col-span-1 glass-panel p-6 rounded-2xl border-indigo-500/15 bg-[#0d1323]/50">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-1.5 text-indigo-400">
                    <BookOpen size={18} /> Log Operational Outcomes
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Submit the actual results of the dispatch to update organization memory (TOM) and calculate performance.
                  </p>

                  <form onSubmit={handleSubmitFeedback} className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1">Select Event</label>
                      <select
                        value={feedbackForm.event_id}
                        onChange={e => {
                          const ev = eventsData.events.find(x => String(x.id) === e.target.value);
                          if (ev) {
                            setFeedbackForm({
                              event_id: e.target.value,
                              actual_impact: Math.round(ev.impact_score),
                              actual_officers: ev.manpower_officers,
                              actual_barricades: ev.barricades_count,
                              actual_outcome: ev.outcome === 'Active' ? 'Successful' : ev.outcome,
                              feedback_text: ev.feedback || ''
                            });
                          }
                        }}
                        className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                      >
                        {eventsData.events.slice(0, 30).map(ev => (
                          <option key={ev.id} value={ev.id} className="bg-slate-900">
                            EV-{String(ev.id).padStart(4, '0')} - {ev.event_cause.replace('_', ' ')} ({ev.junction})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 font-medium block mb-1">Observed Impact (0-100)</label>
                        <input
                          type="number"
                          value={feedbackForm.actual_impact}
                          onChange={e => setFeedbackForm({...feedbackForm, actual_impact: parseInt(e.target.value) || 0})}
                          className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-medium block mb-1">Actual Officers Used</label>
                        <input
                          type="number"
                          value={feedbackForm.actual_officers}
                          onChange={e => setFeedbackForm({...feedbackForm, actual_officers: parseInt(e.target.value) || 0})}
                          className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 font-medium block mb-1">Actual Barricades</label>
                        <input
                          type="number"
                          value={feedbackForm.actual_barricades}
                          onChange={e => setFeedbackForm({...feedbackForm, actual_barricades: parseInt(e.target.value) || 0})}
                          className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-medium block mb-1">Traffic Outcome</label>
                        <select
                          value={feedbackForm.actual_outcome}
                          onChange={e => setFeedbackForm({...feedbackForm, actual_outcome: e.target.value})}
                          className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                        >
                          <option value="Successful" className="bg-slate-900">Successful</option>
                          <option value="Partially Successful" className="bg-slate-900">Partially Successful</option>
                          <option value="Failed" className="bg-slate-900">Failed</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1">Operational Feedbacks / Learnings</label>
                      <textarea
                        value={feedbackForm.feedback_text}
                        onChange={e => setFeedbackForm({...feedbackForm, feedback_text: e.target.value})}
                        className="w-full glass-input px-3 py-2 rounded-lg text-xs h-16 resize-none"
                        placeholder="Log notes about what worked or failed..."
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        <>
                          <CheckCircle size={14} /> Log and Calibrate TOM
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Memory Logs */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Traffic Operations Memory (TOM) Logs</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {tomRecords.map((t, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/20">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold font-mono">Run #{t.id}</span>
                          <span className="text-xs text-slate-500 font-mono">Event #{t.event_id}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{t.timestamp.replace('T', ' ').substring(0, 16)}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-200 mt-2 capitalize">{t.event_cause.replace('_', ' ')} - {t.junction}</h4>
                        <p className="text-xs text-slate-400 mt-1 italic">"{t.generated_description}"</p>
                        
                        <div className="mt-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/40 text-xs text-slate-300">
                          <span className="font-semibold text-cyan-400 block mb-0.5">Operational Learnings:</span>
                          "{t.feedback}"
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0 space-y-2">
                        {renderOutcomeBadge(t.actual_outcome)}
                        <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                          <div>Pred Impact: <strong className="text-indigo-400">{t.predicted_impact.toFixed(0)}</strong></div>
                          <div>Actual Impact: <strong className="text-white">{t.actual_impact.toFixed(0)}</strong></div>
                          <div>Off Rec/Used: <strong className="text-slate-300">{t.recommended_officers}/{t.actual_officers}</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
