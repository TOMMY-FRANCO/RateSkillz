import { useState } from 'react';

interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
}

const CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    label: 'Smileys',
    icon: '😊',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇',
      '🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝',
      '🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄',
      '😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧',
      '🥵','🥶','🥴','😵','🤯','🤠','🥸','😎','🤓','🧐','😕','😟','🙁',
      '😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
      '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿',
      '💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹',
    ],
  },
  {
    id: 'sports',
    label: 'Sports',
    icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸',
      '🥊','🥋','🎯','🪃','🏹','🎣','🤿','🎽','🎿','🛷','🥌','⛸️','🤺',
      '🏋️','🤼','🤸','⛹️','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗',
      '🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','⚡','🔥','💪','🏃',
    ],
  },
  {
    id: 'hands',
    label: 'Hands',
    icon: '👋',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙',
      '👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏',
      '🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶',
      '👂','🦻','👃','👀','👁️','👅','👄','🫀','🫁','🧠','🦷','🦴',
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    icon: '🐶',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷',
      '🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇',
      '🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦟',
      '🦗','🪳','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐊','🐸','🦔','🦡',
      '🦦','🦥','🐿️','🦔','🐾','🐉','🐲','🌵','🎄','🌲','🌳','🌴','🌱',
    ],
  },
  {
    id: 'food',
    label: 'Food',
    icon: '🍕',
    emojis: [
      '🍕','🍔','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗',
      '🍿','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍟','🍱','🍘','🍙',
      '🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠',
      '🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭',
      '🍮','🍯','🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻',
      '🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🍓','🍒','🍑','🥭','🍍',
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹',
      '💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','✡️',
      '🔯','☸️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒',
      '♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️',
      '✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎',
      '🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷',
      '🎵','🎶','✅','❎','🔰','⭐','🌟','💫','✨','🔥','💥','🌈','🎉','🎊',
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState('smileys');

  const current = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];

  return (
    <div className="w-full animate-[slideUpFade_0.2s_ease-out]">
      <div className="bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-2xl mx-0 mb-2 overflow-hidden shadow-2xl">
        <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-white/10 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                activeCategory === cat.id
                  ? 'bg-gradient-to-r from-cyan-600/40 to-teal-600/40 border border-cyan-500/50'
                  : 'hover:bg-white/10'
              }`}
              title={cat.label}
            >
              <span className="text-lg leading-none">{cat.icon}</span>
              <span
                className={`text-xs font-medium transition-colors ${
                  activeCategory === cat.id ? 'text-cyan-300' : 'text-gray-400'
                }`}
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                {cat.label}
              </span>
            </button>
          ))}
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-auto p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none"
            title="Close emoji picker"
          >
            ✕
          </button>
        </div>

        <div className="p-3 h-44 overflow-y-auto">
          <div className="grid grid-cols-8 gap-1">
            {current.emojis.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => onSelect(emoji)}
                className="text-2xl leading-none p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
