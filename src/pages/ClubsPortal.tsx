import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Shield, Loader2, ArrowLeft, Search, Upload, RefreshCw } from 'lucide-react';

interface FootballClub {
  id: string;
  name: string;
  region: string;
  gender: string;
  league: string | null;
  borough: string | null;
  badge_url: string | null;
  is_verified: boolean;
  is_partner: boolean;
}

export default function ClubsPortal() {
  const navigate = useNavigate();
  const toast = useToast();
  const [clubs, setClubs] = useState<FootballClub[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubSearch, setClubSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const badgeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadClubs = useCallback(async () => {
    setClubsLoading(true);
    try {
      const { data, error } = await supabase
        .from('football_clubs')
        .select('id, name, region, gender, league, borough, badge_url, is_verified, is_partner')
        .order('region')
        .order('name');
      if (error) throw error;
      setClubs(data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load clubs');
    } finally {
      setClubsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  const handleToggleVerified = async (club: FootballClub) => {
    setTogglingId(club.id + '_verified');
    try {
      const { error } = await supabase
        .from('football_clubs')
        .update({ is_verified: !club.is_verified })
        .eq('id', club.id);
      if (error) throw error;
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, is_verified: !c.is_verified } : c));
      toast.success(`${club.name} ${!club.is_verified ? 'verified' : 'unverified'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update verified status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleTogglePartner = async (club: FootballClub) => {
    setTogglingId(club.id + '_partner');
    try {
      const { error } = await supabase
        .from('football_clubs')
        .update({ is_partner: !club.is_partner })
        .eq('id', club.id);
      if (error) throw error;
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, is_partner: !c.is_partner } : c));
      toast.success(`${club.name} ${!club.is_partner ? 'marked as partner' : 'removed from partners'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update partner status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleBadgeUpload = async (club: FootballClub, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setUploadingId(club.id);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${club.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('club-badges')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('club-badges').getPublicUrl(path);
      const badge_url = urlData.publicUrl;
      const { error: updateError } = await supabase
        .from('football_clubs')
        .update({ badge_url })
        .eq('id', club.id);
      if (updateError) throw updateError;
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, badge_url } : c));
      toast.success(`Badge uploaded for ${club.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload badge');
    } finally {
      setUploadingId(null);
    }
  };

  const filteredClubs = clubs.filter(c =>
    c.name.toLowerCase().includes(clubSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black pb-24">
      <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-300 hover:text-cyan-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl font-bold text-white">Clubs Portal</h1>
              </div>
            </div>
            <button
              onClick={loadClubs}
              disabled={clubsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 hover:text-white text-sm font-semibold rounded-lg transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${clubsLoading ? 'animate-spin' : ''}`} />
              {clubsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="border border-gray-800 rounded-xl bg-gray-900/50 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Clubs Management</h2>
              {!clubsLoading && (
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                  {filteredClubs.length} club{filteredClubs.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={clubSearch}
                onChange={e => setClubSearch(e.target.value)}
                placeholder="Search clubs by name..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 transition-colors"
              />
            </div>
          </div>

          {clubsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="ml-3 text-gray-400 text-sm">Loading clubs...</span>
            </div>
          ) : filteredClubs.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">
              {clubSearch ? 'No clubs match your search.' : 'No clubs found.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {filteredClubs.map(club => (
                <div key={club.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {club.badge_url ? (
                      <img src={club.badge_url} alt={club.name} className="w-full h-full object-cover" />
                    ) : (
                      <Shield className="w-5 h-5 text-gray-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{club.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {club.region} · {club.gender} · {club.league || 'No league'}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">Verified</span>
                      <button
                        onClick={() => handleToggleVerified(club)}
                        disabled={togglingId === club.id + '_verified'}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60 ${
                          club.is_verified ? 'bg-cyan-600' : 'bg-gray-700'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                            club.is_verified ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">Partner</span>
                      <button
                        onClick={() => handleTogglePartner(club)}
                        disabled={togglingId === club.id + '_partner'}
                        className="flex items-center justify-center w-10 h-5 focus:outline-none disabled:opacity-60"
                        title={club.is_partner ? 'Remove partner' : 'Mark as partner'}
                      >
                        <div className="relative flex items-center justify-center w-5 h-5">
                          <span
                            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                              club.is_partner ? 'bg-green-400' : 'bg-gray-500'
                            }`}
                          />
                          <span
                            className={`relative inline-flex rounded-full h-3 w-3 ${
                              club.is_partner ? 'bg-green-400' : 'bg-gray-500'
                            }`}
                          />
                        </div>
                      </button>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">Badge</span>
                      <button
                        onClick={() => badgeInputRefs.current[club.id]?.click()}
                        disabled={uploadingId === club.id}
                        className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white text-xs rounded-lg transition-all"
                      >
                        {uploadingId === club.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        <span>{uploadingId === club.id ? 'Uploading' : 'Upload'}</span>
                      </button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={el => { badgeInputRefs.current[club.id] = el; }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleBadgeUpload(club, file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
