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

const NORTH_LONDON_WOMENS_CLUBS = [
  {
    name: 'Arsenal Women',
    region: 'North',
    gender: 'womens',
    league: 'WSL',
    borough: 'Islington',
    description:
      'Arsenal Women FC is a professional women\'s football club based in Islington, North London. One of the most decorated women\'s clubs in England, playing home games at the Emirates Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Tottenham Hotspur Women',
    region: 'North',
    gender: 'womens',
    league: 'WSL',
    borough: 'Haringey',
    description:
      'Tottenham Hotspur Women FC compete in the Women\'s Super League. They play their home matches at Tottenham Hotspur Stadium in Haringey, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'London City Lionesses',
    region: 'North',
    gender: 'womens',
    league: 'WSL',
    borough: 'North London',
    description:
      'London City Lionesses are a professional women\'s football club competing in the Women\'s Super League, based in North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'London Bees',
    region: 'North',
    gender: 'womens',
    league: 'National League',
    borough: 'Harrow',
    description:
      'London Bees are a women\'s football club competing in the National League. They play their home matches at The Hive Stadium in Harrow, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Camden Town FC Women',
    region: 'North',
    gender: 'womens',
    league: 'London and South East Regional League',
    borough: 'Camden',
    description:
      'Camden Town FC Women compete in the London and South East Regional League, representing the Camden community in North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Haringey Borough FC Women',
    region: 'North',
    gender: 'womens',
    league: 'Isthmian League',
    borough: 'Haringey',
    description:
      'Haringey Borough FC Women compete in the Isthmian League, playing their home matches at Coles Park in Haringey, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Hampstead Women FC',
    region: 'North',
    gender: 'womens',
    league: 'Regional',
    borough: 'Hampstead',
    description:
      'Hampstead Women FC is a women\'s football club based in Hampstead, North London, competing in regional football.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'East Finchley Women',
    region: 'North',
    gender: 'womens',
    league: 'GLWFL Division One North',
    borough: 'Barnet',
    description:
      'East Finchley Women compete in the Greater London Women\'s Football League Division One North, based in Barnet, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Alexandra Park WFC',
    region: 'North',
    gender: 'womens',
    league: 'GLWFL',
    borough: 'Muswell Hill',
    description:
      'Alexandra Park Women\'s Football Club compete in the Greater London Women\'s Football League, based in Muswell Hill, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Barnet Nightingales FC',
    region: 'North',
    gender: 'womens',
    league: 'Youth',
    borough: 'Barnet',
    description:
      'Barnet Nightingales FC is a youth women\'s football club based in Barnet, North London, developing the next generation of female footballers.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'AFC Southgate',
    region: 'North',
    gender: 'womens',
    league: 'Development',
    borough: 'Southgate',
    description:
      'AFC Southgate Women is a development women\'s football club based in Southgate, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'United Dragons',
    region: 'North',
    gender: 'womens',
    league: 'Grassroots',
    borough: 'Maida Vale',
    description:
      'United Dragons is a grassroots women\'s football club based in Maida Vale, North London, promoting participation and community football.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Limitless Sports FC Women',
    region: 'North',
    gender: 'womens',
    league: 'Youth',
    borough: 'Tottenham',
    description:
      'Limitless Sports FC Women is a youth women\'s football club based in Tottenham, North London, focused on developing young female talent.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Panthera FC',
    region: 'North',
    gender: 'womens',
    league: 'Grassroots',
    borough: 'Barnet',
    description:
      'Panthera FC is a grassroots women\'s football club based in Barnet, North London, providing football opportunities at the community level.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

const ALL_CLUBS = [...NORTH_LONDON_MENS_CLUBS, ...NORTH_LONDON_WOMENS_CLUBS];

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
  const toInsert = ALL_CLUBS.filter(c => !existingNames.has(c.name));

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
