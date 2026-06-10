/**
 * Cookie Policy Page
 *
 * Public page explaining cookie usage and categories.
 */

export default function CookiePolicyPage() {
  return (
    <div
      style={{
        background: '#162944',
        minHeight: '100vh',
        padding: '60px 20px',
        fontFamily: 'Jost, sans-serif',
        color: '#F9F8F5',
      }}
    >
      <div
        style={{
          maxWidth: '680px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <h1
          style={{
            fontFamily: "'Lora', serif",
            fontSize: '36px',
            fontWeight: 600,
            marginBottom: '8px',
            color: '#F9F8F5',
          }}
        >
          Cookie Policy
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(249, 248, 245, 0.6)',
            marginBottom: '48px',
          }}
        >
          Last updated: June 2026
        </p>

        {/* Section: What are cookies? */}
        <section style={{ marginBottom: '40px' }}>
          <h2
            style={{
              fontFamily: "'Lora', serif",
              fontSize: '24px',
              fontWeight: 600,
              marginBottom: '16px',
              color: '#F9F8F5',
            }}
          >
            What are cookies?
          </h2>
          <p
            style={{
              fontSize: '15px',
              lineHeight: '1.6',
              color: 'rgba(249, 248, 245, 0.9)',
            }}
          >
            Cookies are small text files stored on your device when you visit a
            website. They help us provide you with a better experience by
            remembering your preferences and understanding how you use Refyne.
          </p>
        </section>

        {/* Section: Cookies we use */}
        <section style={{ marginBottom: '40px' }}>
          <h2
            style={{
              fontFamily: "'Lora', serif",
              fontSize: '24px',
              fontWeight: 600,
              marginBottom: '16px',
              color: '#F9F8F5',
            }}
          >
            Cookies we use
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid rgba(249, 248, 245, 0.2)',
                  }}
                >
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontWeight: 600,
                      color: '#F9F8F5',
                    }}
                  >
                    Cookie name
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontWeight: 600,
                      color: '#F9F8F5',
                    }}
                  >
                    Category
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontWeight: 600,
                      color: '#F9F8F5',
                    }}
                  >
                    Purpose
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontWeight: 600,
                      color: '#F9F8F5',
                    }}
                  >
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  style={{
                    borderBottom: '1px solid rgba(249, 248, 245, 0.1)',
                  }}
                >
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    __session
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Essential
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Authentication
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Session
                  </td>
                </tr>
                <tr
                  style={{
                    borderBottom: '1px solid rgba(249, 248, 245, 0.1)',
                  }}
                >
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    __client_uat
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Essential
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Auth state
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    1 year
                  </td>
                </tr>
                <tr
                  style={{
                    borderBottom: '1px solid rgba(249, 248, 245, 0.1)',
                  }}
                >
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    refyne_onboarding_complete
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Essential
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Setup tracking
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    1 year
                  </td>
                </tr>
                <tr
                  style={{
                    borderBottom: '1px solid rgba(249, 248, 245, 0.1)',
                  }}
                >
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    refyne_cookie_consent
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Essential
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Your preferences
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    1 year
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Sentry session replay
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Analytics
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Error debugging
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'rgba(249, 248, 245, 0.9)',
                    }}
                  >
                    Session
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section: Your choices */}
        <section style={{ marginBottom: '40px' }}>
          <h2
            style={{
              fontFamily: "'Lora', serif",
              fontSize: '24px',
              fontWeight: 600,
              marginBottom: '16px',
              color: '#F9F8F5',
            }}
          >
            Your choices
          </h2>
          <p
            style={{
              fontSize: '15px',
              lineHeight: '1.6',
              color: 'rgba(249, 248, 245, 0.9)',
            }}
          >
            You can change your cookie preferences at any time by clicking
            "Cookie preferences" in the footer.
          </p>
        </section>

        {/* Section: Contact */}
        <section>
          <h2
            style={{
              fontFamily: "'Lora', serif",
              fontSize: '24px',
              fontWeight: 600,
              marginBottom: '16px',
              color: '#F9F8F5',
            }}
          >
            Contact
          </h2>
          <p
            style={{
              fontSize: '15px',
              lineHeight: '1.6',
              color: 'rgba(249, 248, 245, 0.9)',
            }}
          >
            Questions? Email{' '}
            <a
              href="mailto:privacy@refynedata.com"
              style={{
                color: '#2E6BA8',
                textDecoration: 'none',
              }}
            >
              privacy@refynedata.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
