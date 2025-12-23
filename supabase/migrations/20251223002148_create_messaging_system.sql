-- Create user_status table
CREATE TABLE IF NOT EXISTS user_status (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online boolean DEFAULT false,
  last_seen timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_one_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_two_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT different_users CHECK (user_one_id != user_two_id),
  CONSTRAINT ordered_users CHECK (user_one_id < user_two_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create typing_status table
CREATE TABLE IF NOT EXISTS typing_status (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  is_typing boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_one ON conversations(user_one_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_two ON conversations(user_two_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_typing_status_conversation ON typing_status(conversation_id);

-- Enable RLS
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_status
CREATE POLICY "Users can view any user status"
  ON user_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own status"
  ON user_status FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own status"
  ON user_status FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for conversations
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_one_id OR auth.uid() = user_two_id
  );

CREATE POLICY "Users can create conversations with friends"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_one_id OR auth.uid() = user_two_id) AND
    EXISTS (
      SELECT 1 FROM friends
      WHERE (
        (user_id = user_one_id AND friend_id = user_two_id) OR
        (user_id = user_two_id AND friend_id = user_one_id)
      ) AND status = 'accepted'
    )
  );

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_one_id OR auth.uid() = user_two_id)
  WITH CHECK (auth.uid() = user_one_id OR auth.uid() = user_two_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can send messages to friends"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM friends
      WHERE (
        (user_id = sender_id AND friend_id = recipient_id) OR
        (user_id = recipient_id AND friend_id = sender_id)
      ) AND status = 'accepted'
    )
  );

CREATE POLICY "Users can update messages they received"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- RLS Policies for typing_status
CREATE POLICY "Users can view typing status in their conversations"
  ON typing_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id AND
      (auth.uid() = user_one_id OR auth.uid() = user_two_id)
    )
  );

CREATE POLICY "Users can insert own typing status"
  ON typing_status FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own typing status"
  ON typing_status FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own typing status"
  ON typing_status FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to get or create conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_user_one_id uuid,
  p_user_two_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id uuid;
  v_ordered_user_one uuid;
  v_ordered_user_two uuid;
BEGIN
  IF p_user_one_id < p_user_two_id THEN
    v_ordered_user_one := p_user_one_id;
    v_ordered_user_two := p_user_two_id;
  ELSE
    v_ordered_user_one := p_user_two_id;
    v_ordered_user_two := p_user_one_id;
  END IF;

  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE user_one_id = v_ordered_user_one AND user_two_id = v_ordered_user_two;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (user_one_id, user_two_id)
    VALUES (v_ordered_user_one, v_ordered_user_two)
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET is_read = true, read_at = now()
  WHERE conversation_id = p_conversation_id
    AND recipient_id = p_user_id
    AND is_read = false;
END;
$$;

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM messages
  WHERE recipient_id = p_user_id AND is_read = false;
  
  RETURN v_count;
END;
$$;

-- Trigger to update conversation metadata when new message is sent
CREATE OR REPLACE FUNCTION update_conversation_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_conversation_on_new_message ON messages;
CREATE TRIGGER trigger_update_conversation_on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_new_message();

-- Initialize user_status for existing users
INSERT INTO user_status (user_id, is_online, last_seen)
SELECT id, false, now()
FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_status)
ON CONFLICT (user_id) DO NOTHING;

-- Trigger to create user_status when new user is created
CREATE OR REPLACE FUNCTION create_user_status_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_status (user_id, is_online, last_seen)
  VALUES (NEW.id, true, now())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_user_status ON profiles;
CREATE TRIGGER trigger_create_user_status
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_status_on_signup();
