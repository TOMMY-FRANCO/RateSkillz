import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://niurjxqttyaxmjrladrs.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pdXJqeHF0dHlheG1qcmxhZHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MDk0MDYsImV4cCI6MjA4MTA4NTQwNn0.KoN39yci3qsM3NT7nUpns96AHh6LMy_DxUPJ3AJc6mE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const NORTH_LONDON_MENS_CLUBS = [
  {
    name: 'Arsenal FC',
    region: 'North',
    gender: 'mens',
    league: 'Premier League',
    borough: 'Islington',
    description:
      'Arsenal Football Club is a professional football club based in Islington, North London. One of the most successful clubs in English football history, playing home games at the Emirates Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Tottenham Hotspur',
    region: 'North',
    gender: 'mens',
    league: 'Premier League',
    borough: 'Haringey',
    description:
      'Tottenham Hotspur Football Club is a professional football club based in Haringey, North London. Known as Spurs, they play at the state-of-the-art Tottenham Hotspur Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Barnet FC',
    region: 'North',
    gender: 'mens',
    league: 'National League',
    borough: 'Barnet',
    description:
      'Barnet Football Club, known as the Bees, compete in the National League. They play their home matches at The Hive Stadium in Barnet, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Enfield Town',
    region: 'North',
    gender: 'mens',
    league: 'National League South',
    borough: 'Enfield',
    description:
      'Enfield Town FC is a community football club based in Enfield, North London. They compete in the National League South and play at Queen Elizabeth II Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Haringey Borough',
    region: 'North',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Haringey',
    description:
      'Haringey Borough FC is a non-league football club based in Haringey, North London. They play in the Isthmian League at Coles Park.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Wingate and Finchley',
    region: 'North',
    gender: 'mens',
    league: 'Isthmian League Premier',
    borough: 'Barnet',
    description:
      'Wingate & Finchley FC is a non-league football club based in North London. They compete in the Isthmian League Premier Division and play at Maurice Rebak Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Hendon FC',
    region: 'North',
    gender: 'mens',
    league: 'Isthmian League Premier',
    borough: 'Barnet',
    description:
      'Hendon Football Club is a semi-professional football club based in North London. They play in the Isthmian League Premier Division at Silver Jubilee Park.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

async function seedClubs() {
  console.log('Starting club seed...');

  const { data: existing, error: fetchError } = await supabase
    .from('football_clubs')
    .select('name');

  if (fetchError) {
    console.error('Failed to fetch existing clubs:', fetchError.message);
    process.exit(1);
  }

  const existingNames = new Set((existing || []).map((c: { name: string }) => c.name));
  const toInsert = NORTH_LONDON_MENS_CLUBS.filter(c => !existingNames.has(c.name));

  if (toInsert.length === 0) {
    console.log('All clubs already exist — nothing to insert.');
    return;
  }

  console.log(`Inserting ${toInsert.length} club(s):`);
  toInsert.forEach(c => console.log(` - ${c.name}`));

  const { error: insertError } = await supabase.from('football_clubs').insert(toInsert);

  if (insertError) {
    console.error('Insert failed:', insertError.message);
    process.exit(1);
  }

  console.log('Seed complete.');
}

seedClubs();
