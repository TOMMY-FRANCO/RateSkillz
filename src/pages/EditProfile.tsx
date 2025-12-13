import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Upload, User, ArrowLeft, Save } from 'lucide-react';

export default function EditProfile() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [position, setPosition] = useState(profile?.position || '');
  const [number, setNumber] = useState(profile?.number || '');
  const [team, setTeam] = useState(profile?.team || '');
  const [height, setHeight] = useState(profile?.height || '');
  const [weight, setWeight] = useState(profile?.weight || '');
  const [achievements, setAchievements] = useState(profile?.achievements || '');
  const [stats, setStats] = useState(profile?.stats || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || '');
  const [avatarPosition, setAvatarPosition] = useState(
    profile?.avatar_position || { x: 0, y: 0, scale: 1 }
  );
  const [showPositioning, setShowPositioning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage('');

      if (!e.target.files || e.target.files.length === 0) {
        return;
      }

      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setAvatarPreview(dataUrl);
        setShowPositioning(true);
        setMessage('Use the controls below to position your image');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      setMessage('Error uploading photo: ' + (error as Error).message);
      setUploading(false);
    }
  };

  const saveAvatar = async () => {
    await updateProfile({ avatar_url: avatarPreview, avatar_position: avatarPosition });
    setShowPositioning(false);
    setMessage('Photo saved successfully!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const { error } = await updateProfile({
      full_name: fullName,
      bio,
      position,
      number,
      team,
      height,
      weight,
      achievements,
      stats,
    });

    if (error) {
      setMessage('Error updating profile: ' + error.message);
    } else {
      setMessage('Profile updated successfully!');
      setTimeout(() => navigate('/dashboard'), 1500);
    }

    setSaving(false);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-300 hover:text-cyan-400 transition-colors bg-none border-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white">Edit Profile</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8">
          <div className="mb-8 text-center">
            <div className="relative inline-block">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden border-4 border-cyan-500/30">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    style={{
                      transform: `translate(${avatarPosition.x}px, ${avatarPosition.y}px) scale(${avatarPosition.scale})`,
                      transformOrigin: 'center center',
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-16 h-16 text-gray-600" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-10 h-10 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50"
              >
                <Upload className="w-5 h-5 text-black" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {uploading && (
              <p className="mt-2 text-sm text-cyan-400">Uploading...</p>
            )}

            {showPositioning && avatarPreview && (
              <div className="mt-6 space-y-4 bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Position Your Image</h3>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Horizontal Position</label>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={avatarPosition.x}
                    onChange={(e) => setAvatarPosition({ ...avatarPosition, x: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Vertical Position</label>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={avatarPosition.y}
                    onChange={(e) => setAvatarPosition({ ...avatarPosition, y: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Zoom: {avatarPosition.scale.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={avatarPosition.scale}
                    onChange={(e) => setAvatarPosition({ ...avatarPosition, scale: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={saveAvatar}
                    className="flex-1 py-2 bg-green-500 text-black font-semibold rounded-lg hover:bg-green-400 transition-all"
                  >
                    Save Position
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarPosition({ x: 0, y: 0, scale: 1 });
                    }}
                    className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={profile.username}
                disabled
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-300 mb-2">
                  Position
                </label>
                <input
                  id="position"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="Striker"
                />
              </div>

              <div>
                <label htmlFor="number" className="block text-sm font-medium text-gray-300 mb-2">
                  Jersey Number
                </label>
                <input
                  id="number"
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="team" className="block text-sm font-medium text-gray-300 mb-2">
                Team
              </label>
              <select
                id="team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              >
                <option value="">Select a team</option>
                <option value="Arsenal">Arsenal</option>
                <option value="Aston Villa">Aston Villa</option>
                <option value="Barnet">Barnet</option>
                <option value="Barrow">Barrow</option>
                <option value="Birmingham City">Birmingham City</option>
                <option value="Blackburn Rovers">Blackburn Rovers</option>
                <option value="Blackpool">Blackpool</option>
                <option value="Bolton Wanderers">Bolton Wanderers</option>
                <option value="Bournemouth">Bournemouth</option>
                <option value="Brentford">Brentford</option>
                <option value="Brighton & Hove Albion">Brighton & Hove Albion</option>
                <option value="Bristol Rovers">Bristol Rovers</option>
                <option value="Burnley">Burnley</option>
                <option value="Charlton Athletic">Charlton Athletic</option>
                <option value="Chelsea">Chelsea</option>
                <option value="Coventry City">Coventry City</option>
                <option value="Crewe Alexandra">Crewe Alexandra</option>
                <option value="Crystal Palace">Crystal Palace</option>
                <option value="Everton">Everton</option>
                <option value="Fulham">Fulham</option>
                <option value="Ipswich Town">Ipswich Town</option>
                <option value="Leeds United">Leeds United</option>
                <option value="Leicester City">Leicester City</option>
                <option value="Liverpool">Liverpool</option>
                <option value="Manchester City">Manchester City</option>
                <option value="Manchester United">Manchester United</option>
                <option value="Newcastle United">Newcastle United</option>
                <option value="Nottingham Forest">Nottingham Forest</option>
                <option value="Oldham Athletic">Oldham Athletic</option>
                <option value="Queens Park Rangers">Queens Park Rangers</option>
                <option value="Reading">Reading</option>
                <option value="Sheffield United">Sheffield United</option>
                <option value="Sheffield Wednesday">Sheffield Wednesday</option>
                <option value="Sunderland">Sunderland</option>
                <option value="Tottenham Hotspur">Tottenham Hotspur</option>
                <option value="West Bromwich Albion">West Bromwich Albion</option>
                <option value="West Ham United">West Ham United</option>
                <option value="Wolverhampton Wanderers">Wolverhampton Wanderers</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-gray-300 mb-2">
                  Height
                </label>
                <input
                  id="height"
                  type="text"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="5'10&quot;"
                />
              </div>

              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-gray-300 mb-2">
                  Weight
                </label>
                <input
                  id="weight"
                  type="text"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="165 lbs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-300 mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
                placeholder="Tell us about yourself..."
              />
            </div>

            <div>
              <label htmlFor="achievements" className="block text-sm font-medium text-gray-300 mb-2">
                Achievements
              </label>
              <textarea
                id="achievements"
                rows={3}
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
                placeholder="Awards, trophies, honors..."
              />
            </div>

            <div>
              <label htmlFor="stats" className="block text-sm font-medium text-gray-300 mb-2">
                Career Stats
              </label>
              <textarea
                id="stats"
                rows={3}
                value={stats}
                onChange={(e) => setStats(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
                placeholder="Goals, assists, matches played..."
              />
            </div>

            {message && (
              <div className={`rounded-lg p-3 ${
                message.includes('Error')
                  ? 'bg-red-500/10 border border-red-500/50 text-red-400'
                  : 'bg-green-500/10 border border-green-500/50 text-green-400'
              }`}>
                <p className="text-sm">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
