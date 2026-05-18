import { SignIn } from '@clerk/nextjs';
import { C, F } from '@/lib/design-tokens';

export default function SignInPage() {
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
      <SignIn
        appearance={{
          elements: {
            rootBox: { margin: '0 auto' },
            card: {
              background: C.sidebar,
              border: `1px solid ${C.border}`,
            },
          },
        }}
      />
    </div>
  );
}
