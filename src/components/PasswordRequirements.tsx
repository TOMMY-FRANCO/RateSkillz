import { Check, X } from 'lucide-react';

interface PasswordRequirementsProps {
  password: string;
}

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  {
    label: 'At least 8 characters',
    test: (password: string) => password.length >= 8,
  },
  {
    label: 'One uppercase letter',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    label: 'One lowercase letter',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    label: 'One number',
    test: (password: string) => /\d/.test(password),
  },
  {
    label: 'One special character (!@#$%^&*)',
    test: (password: string) => /[!@#$%^&*]/.test(password),
  },
];

export const validatePassword = (password: string): boolean => {
  return requirements.every((req) => req.test(password));
};

export default function PasswordRequirements({ password }: PasswordRequirementsProps) {
  return (
    <div className="mt-2 space-y-2">
      <p className="text-sm font-medium text-gray-700">Password Requirements:</p>
      <div className="space-y-1">
        {requirements.map((req, index) => {
          const isMet = req.test(password);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              {isMet ? (
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
              <span className={isMet ? 'text-green-600' : 'text-gray-600'}>
                {req.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
