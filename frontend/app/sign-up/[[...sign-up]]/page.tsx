import { SignUp } from '@clerk/nextjs';
import { C, F } from '@/lib/design-tokens';

export default function SignUpPage() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: C.bg,
        fontFamily: F.sans,
      }}
    >
      <SignUp
        appearance={{
          baseTheme: undefined,
          variables: {
            colorBackground: C.sidebar,
            colorText: C.text,
            colorPrimary: '#6366F1',
            colorInputBackground: C.bg,
            colorInputText: C.text,
          },
          elements: {
            rootBox: { margin: '0 auto' },
            card: {
              background: C.sidebar,
              border: `1px solid ${C.border}`,
            },
            formButtonPrimary: {
              background: '#6366F1',
              '&:hover': {
                background: '#4F46E5',
              },
            },
          },
        }}
      />
    </div>
  );
}
