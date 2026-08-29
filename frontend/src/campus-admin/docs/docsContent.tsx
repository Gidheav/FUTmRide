import React from 'react';
import { T } from '../theme';
import { AlertCircle, CheckCircle, Info, ShieldAlert } from 'lucide-react';

// --- Helper Components for Styling ---
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 20, fontWeight: 700, color: T.textWhite, marginTop: 32, marginBottom: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
    {children}
  </h2>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontSize: 16, fontWeight: 600, color: T.textWhite, marginTop: 24, marginBottom: 12 }}>
    {children}
  </h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
    {children}
  </p>
);

const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul style={{ paddingLeft: 24, margin: '0 0 16px 0', color: T.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
    {children}
  </ul>
);

const Li = ({ children }: { children: React.ReactNode }) => (
  <li style={{ marginBottom: 8 }}>{children}</li>
);

const Callout = ({ type = 'info', title, children }: { type?: 'info'|'warning'|'success', title: string, children: React.ReactNode }) => {
  const bg = type === 'info' ? 'rgba(59, 130, 246, 0.1)' : type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)';
  const color = type === 'info' ? '#3b82f6' : type === 'warning' ? '#f59e0b' : '#10b981';
  const Icon = type === 'info' ? Info : type === 'warning' ? ShieldAlert : CheckCircle;
  
  return (
    <div style={{ background: bg, borderLeft: `4px solid ${color}`, padding: '16px', borderRadius: '0 8px 8px 0', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color, fontWeight: 600, fontSize: 14 }}>
        <Icon size={18} />
        <span>{title}</span>
      </div>
      <div style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
};

const Badge = ({ children, color = '#3b82f6' }: { children: React.ReactNode, color?: string }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, background: `${color}20`, color, fontSize: 12, fontWeight: 600, marginRight: 8 }}>
    {children}
  </span>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <code style={{ background: T.bgCard, padding: '2px 6px', borderRadius: 4, color: T.accent, fontSize: 13, fontFamily: 'monospace' }}>
    {children}
  </code>
);

const CodeBlock = ({ children }: { children: React.ReactNode }) => (
  <pre style={{ 
    background: T.bgCard, 
    padding: '16px', 
    borderRadius: 8, 
    color: T.textSecondary, 
    fontSize: 13, 
    fontFamily: 'monospace',
    overflow: 'auto',
    marginBottom: 16,
    border: `1px solid ${T.border}`
  }}>
    {children}
  </pre>
);

const Table = ({ children }: { children: React.ReactNode }) => (
  <table style={{ 
    width: '100%', 
    borderCollapse: 'collapse', 
    marginBottom: 16,
    fontSize: 14,
    color: T.textSecondary
  }}>
    {children}
  </table>
);

const Th = ({ children }: { children: React.ReactNode }) => (
  <th style={{ 
    textAlign: 'left', 
    padding: '12px', 
    borderBottom: `2px solid ${T.border}`,
    color: T.textWhite,
    fontWeight: 600,
    background: T.bgCard
  }}>
    {children}
  </th>
);

const Td = ({ children }: { children: React.ReactNode }) => (
  <td style={{ 
    padding: '12px', 
    borderBottom: `1px solid ${T.border}`,
    background: T.bgCard
  }}>
    {children}
  </td>
);

export const DOCS_CONTENT: Record<string, Record<string, React.ReactNode>> = {
  admin: {
    overview: (
      <div>
        <P>LR-Ride is a campus-focused ride-sharing and logistics platform designed for controlled environments like universities, corporate campuses, and private estates. It connects students/passengers with verified drivers through an optimized dispatch engine.</P>
        <H2>System Hierarchy</H2>
        <Ul>
          <Li><strong>Super Admin:</strong> Manages overall platform health, billing, and creates Campus Admins.</Li>
          <Li><strong>Campus Admin:</strong> Manages a specific campus (e.g., pricing, driver approvals, zones).</Li>
          <Li><strong>Driver:</strong> Verified vehicle operators accepting ping or queue-based rides.</Li>
          <Li><strong>Student/Passenger:</strong> Verified users who request rides and pay via internal wallets.</Li>
        </Ul>
        <H2>Technology Stack</H2>
        <Callout type="info" title="Infrastructure">
          <Ul>
            <Li><strong>Frontend:</strong> React, Vite, Lucide Icons, plain CSS styling.</Li>
            <Li><strong>Mobile:</strong> React Native / Expo (Driver and Student apps).</Li>
            <Li><strong>Backend:</strong> Node.js, Express, PostgreSQL (Prisma), Redis (for geospacial tracking).</Li>
            <Li><strong>Deployment:</strong> Render (API), Vercel (Web Panel), AWS S3 (Document Storage).</Li>
          </Ul>
        </Callout>
      </div>
    ),
    auth: (
      <div>
        <P>The authentication system secures all admin panel endpoints and maintains role-based access control (RBAC) with enterprise-grade security measures, session management, and multi-factor authentication capabilities.</P>
        
        <H2>Architecture Overview</H2>
        <Callout type="info" title="Core Components">
          <Ul>
            <Li><strong>Backend:</strong> Django REST Framework with JWT authentication via <Code>rest_framework_simplejwt</Code></Li>
            <Li><strong>Frontend:</strong> React with Zustand state management and Axios interceptors</Li>
            <Li><strong>Token Storage:</strong> SessionStorage for primary tokens with localStorage migration support</Li>
            <Li><strong>WebSocket Auth:</strong> Custom middleware supporting both header and query-based token transmission</Li>
            <Li><strong>Security Layers:</strong> Rate limiting, throttling, CSP headers, and IP-based restrictions</Li>
          </Ul>
        </Callout>

        <H2>JWT Token Flow</H2>
        <P>The authentication system uses a dual-token approach with automatic refresh capabilities:</P>
        <Ul>
          <Li><strong>Access Token:</strong> Short-lived (60 minutes) used for API requests</Li>
          <Li><strong>Refresh Token:</strong> Long-lived (14 days) used to obtain new access tokens</Li>
          <Li><strong>Automatic Refresh:</strong> Axios interceptors automatically refresh tokens on 401 responses</Li>
          <Li><strong>Token Rotation:</strong> Refresh tokens rotate on each use with old tokens blacklisted</Li>
        </Ul>

        <H3>Token Lifecycle</H3>
        <Ul>
          <Li>User submits credentials via <Code>POST /auth/login/</Code></Li>
          <Li>Server validates credentials and checks 2FA status</Li>
          <Li>System issues access and refresh tokens with user payload</Li>
          <Li>Tokens stored in sessionStorage (primary) with localStorage fallback</Li>
          <Li>API requests include Bearer token in Authorization header</Li>
          <Li>On 401 response, interceptor automatically refreshes via <Code>POST /auth/token/refresh/</Code></Li>
          <Li>Logout blacklists refresh token and clears storage</Li>
        </Ul>

        <H2>Session Management</H2>
        <Callout type="warning" title="Session Security">
          <P>Sessions are enforced with a maximum age of 14 days. The system tracks <Code>session_started_at</Code> and <Code>last_refresh_at</Code> to enforce session limits. If a session exceeds the maximum age or the refresh token is revoked (e.g., account suspension), the user is forced to log out and redirected to the login screen.</P>
        </Callout>

        <H2>User Roles & Permissions</H2>
        <P>The system implements a 4-tier role hierarchy with granular permission control:</P>
        <Ul>
          <Li><Badge color="#ef4444">Super Admin</Badge> Platform-wide management, billing, and campus admin creation</Li>
          <Li><Badge color="#f59e0b">Campus Admin</Badge> Campus-specific operations, pricing, driver approvals</Li>
          <Li><Badge color="#3b82f6">Driver</Badge> Vehicle operators accepting rides and managing availability</Li>
          <Li><Badge color="#10b981">Student</Badge> Passengers requesting rides and managing payments</Li>
        </Ul>

        <H3>Permission Classes</H3>
        <Ul>
          <Li><Code>IsAdminUser</Code> - Super admin access only</Li>
          <Li><Code>IsCampusAdminUser</Code> - Campus-specific admin access</Li>
          <Li><Code>IsAdminOrCampusAdmin</Code> - Combined admin access</Li>
          <Li><Code>IsDriverUser</Code> - Driver-specific functionality</Li>
          <Li><Code>IsStudentUser</Code> - Student-specific functionality</Li>
          <Li><Code>IsOwnerOrAdmin</Code> - Resource ownership + admin override</Li>
          <Li><Code>IsPhoneVerified</Code> - Requires phone verification</Li>
        </Ul>

        <H2>Authentication Endpoints</H2>
        <Table>
          <thead>
            <tr>
              <Th>Endpoint</Th>
              <Th>Method</Th>
              <Th>Description</Th>
              <Th>Auth Required</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td><Code>/auth/register/request-email-otp/</Code></Td>
              <Td>POST</Td>
              <Td>Student email verification</Td>
              <Td>No</Td>
            </tr>
            <tr>
              <Td><Code>/auth/register/verify-email-otp/</Code></Td>
              <Td>POST</Td>
              <Td>Email confirmation</Td>
              <Td>No</Td>
            </tr>
            <tr>
              <Td><Code>/auth/register/</Code></Td>
              <Td>POST</Td>
              <Td>User registration</Td>
              <Td>No</Td>
            </tr>
            <tr>
              <Td><Code>/auth/login/</Code></Td>
              <Td>POST</Td>
              <Td>User login</Td>
              <Td>No</Td>
            </tr>
            <tr>
              <Td><Code>/auth/otp/request/</Code></Td>
              <Td>POST</Td>
              <Td>OTP request</Td>
              <Td>No</Td>
            </tr>
            <tr>
              <Td><Code>/auth/otp/verify/</Code></Td>
              <Td>POST</Td>
              <Td>OTP verification</Td>
              <Td>No</Td>
            </tr>
            <tr>
              <Td><Code>/auth/password-reset/request/</Code></Td>
              <Td>POST</Td>
              <Td>Password reset request</Td>
              <Td>No</Td>
            </tr>
            <tr>
              <Td><Code>/auth/token/refresh/</Code></Td>
              <Td>POST</Td>
              <Td>Token refresh</Td>
              <Td>No</Td>
            </tr>
            <tr>
              <Td><Code>/auth/logout/</Code></Td>
              <Td>POST</Td>
              <Td>User logout</Td>
              <Td>Yes</Td>
            </tr>
            <tr>
              <Td><Code>/auth/change-password/</Code></Td>
              <Td>POST</Td>
              <Td>Password change</Td>
              <Td>Yes</Td>
            </tr>
            <tr>
              <Td><Code>/auth/settings/preferences/</Code></Td>
              <Td>POST</Td>
              <Td>User preferences</Td>
              <Td>Yes</Td>
            </tr>
            <tr>
              <Td><Code>/auth/settings/pin/set/</Code></Td>
              <Td>POST</Td>
              <Td>Transaction PIN setup</Td>
              <Td>Yes</Td>
            </tr>
            <tr>
              <Td><Code>/auth/settings/2fa/start/</Code></Td>
              <Td>POST</Td>
              <Td>2FA setup initiation</Td>
              <Td>Yes</Td>
            </tr>
            <tr>
              <Td><Code>/auth/settings/2fa/confirm/</Code></Td>
              <Td>POST</Td>
              <Td>2FA confirmation</Td>
              <Td>Yes</Td>
            </tr>
            <tr>
              <Td><Code>/auth/2fa/verify/</Code></Td>
              <Td>POST</Td>
              <Td>2FA challenge verification</Td>
              <Td>Yes</Td>
            </tr>
          </tbody>
        </Table>

        <H2>Login Flow Implementation</H2>
        <H3>Credential Validation</H3>
        <Ul>
          <Li>Students must use university email (<Code>name.m1234567@st.futminna.edu.ng</Code>)</Li>
          <Li>Other roles use phone number authentication</Li>
          <Li>Email validation regex enforced for students</Li>
          <Li>Optimized user retrieval with <Code>select_related</Code> to prevent N+1 queries</Li>
        </Ul>

        <H3>Security Checks</H3>
        <Ul>
          <Li>Account lockout status check</Li>
          <Li>Failed login attempt counter (5 attempts = 15 min lock)</Li>
          <Li>Account activation status verification</Li>
          <Li>Password verification with BCrypt/Argon2 hashing</Li>
          <Li>Two-factor authentication enforcement when enabled</Li>
        </Ul>

        <H2>Security Features</H2>
        <H3>Rate Limiting</H3>
        <Callout type="info" title="Authentication-Specific Limits">
          <Ul>
            <Li><Code>/auth/login/</Code> - 120 requests per minute</Li>
            <Li><Code>/auth/register/</Code> - 60 requests per 5 minutes</Li>
            <Li><Code>/auth/otp/</Code> - 60 requests per 5 minutes</Li>
            <Li><Code>/auth/otp/verify/</Code> - 120 requests per 5 minutes</Li>
            <Li><Code>/auth/password-reset/</Code> - 60 requests per 5 minutes</Li>
          </Ul>
        </Callout>

        <H3>Account Lockout</H3>
        <P>Failed login attempts are tracked with automatic lockout after 5 failed attempts (15-minute lock duration). The system resets the counter on successful login.</P>

        <H3>Password Security</H3>
        <Ul>
          <Li>Multiple hashing algorithms supported (BCrypt, PBKDF2, Argon2)</Li>
          <Li>Configurable password complexity requirements</Li>
          <Li>Secure password reset flow via OTP</Li>
        </Ul>

        <H2>Two-Factor Authentication (2FA)</H2>
        <P>Optional 2FA support adds an additional security layer for sensitive operations:</P>
        <Ul>
          <Li>TOTP-based two-factor authentication</Li>
          <Li>Configurable 2FA methods per user</Li>
          <Li>Challenge flow during login when 2FA is enabled</Li>
          <Li>Setup, confirmation, and disable workflows</Li>
        </Ul>

        <H2>OTP System</H2>
        <P>One-Time Passwords are used for various verification purposes:</P>
        <Ul>
          <Li><Badge>Phone Verification</Badge> Initial phone number verification</Li>
          <Li><Badge>Login</Badge> Alternative login method</Li>
          <Li><Badge>Password Reset</Badge> Secure password recovery</Li>
          <Li><Badge>Transaction PIN</Badge> Financial transaction authorization</Li>
          <Li><Badge>Two-Factor</Badge> 2FA challenge verification</Li>
        </Ul>

        <H3>OTP Security Features</H3>
        <Ul>
          <Li>6-digit numeric codes with configurable expiration</Li>
          <Li>Automatic invalidation of unused OTPs on new requests</Li>
          <Li>Attempt limiting (3 attempts per OTP)</Li>
          <Li>SMS delivery via Termii integration</Li>
          <Li>Comprehensive logging for security monitoring</Li>
        </Ul>

        <H2>WebSocket Authentication</H2>
        <P>Real-time features use JWT-based WebSocket authentication with multiple token transmission methods:</P>
        <Ul>
          <Li><strong>Authorization Header</strong> (Preferred): <Code>Bearer &lt;token&gt;</Code></Li>
          <Li><strong>WebSocket Protocol:</strong> <Code>access_token.&lt;token&gt;</Code></Li>
          <Li><strong>Query Parameter</strong> (Legacy): <Code>?token=&lt;token&gt;</Code></Li>
        </Ul>

        <H2>Audit Logging</H2>
        <P>Comprehensive audit trail for security-sensitive events:</P>
        <Ul>
          <Li>Login/logout events with IP addresses</Li>
          <Li>Password changes and role modifications</Li>
          <Li>Financial transactions (wallet credits/debits)</Li>
          <Li>Integration and configuration updates</Li>
          <Li>User modifications and administrative actions</Li>
        </Ul>

        <H2>Frontend Integration</H2>
        <H3>State Management</H3>
        <P>Zustand-based authentication store with persistence handles user state, tokens, and authentication status across the application.</P>

        <H3>Token Storage Strategy</H3>
        <Callout type="success" title="Security Best Practice">
          <P>Tokens are primarily stored in sessionStorage for security (cleared on tab close) with localStorage migration support for legacy sessions. The system automatically migrates tokens from localStorage to sessionStorage on load.</P>
        </Callout>

        <H3>Automatic Token Refresh</H3>
        <P>Axios interceptors handle 401 responses by automatically refreshing tokens using the refresh token. If refresh fails, the system clears tokens and redirects to login.</P>

        <H2>Configuration</H2>
        <H3>Environment Variables</H3>
        <Ul>
          <Li><Code>SECRET_KEY</Code> - Core application secret</Li>
          <Li><Code>JWT_SECRET_KEY</Code> - JWT signing key (falls back to SECRET_KEY)</Li>
          <Li><Code>OTP_EXPIRY_MINUTES</Code> - OTP validity period (default: 10)</Li>
          <Li><Code>SESSION_MAX_AGE_DAYS</Code> - Maximum session duration (default: 14)</Li>
          <Li><Code>RATE_LIMIT_ENABLED</Code> - Enable/disable rate limiting</Li>
          <Li><Code>TERMII_API_KEY</Code> - SMS provider integration</Li>
        </Ul>

        <H2>Security Best Practices</H2>
        <Callout type="warning" title="Implemented Security Measures">
          <Ul>
            <Li>Short-lived access tokens (60 minutes)</Li>
            <Li>Refresh token rotation with blacklisting</Li>
            <Li>IP-based and identifier-based rate limiting</Li>
            <Li>Failed login attempt tracking with lockout</Li>
            <Li>Phone and email verification requirements</Li>
            <Li>Maximum session age enforcement</Li>
            <Li>Secure token storage (sessionStorage preference)</Li>
            <Li>HTTPS enforcement in production</Li>
            <Li>Content Security Policy headers</Li>
            <Li>Permissions policy headers</Li>
          </Ul>
        </Callout>

        <H2>Troubleshooting</H2>
        <H3>Common Issues</H3>
        <Ul>
          <Li><strong>Token Refresh Failures:</strong> Check session age vs <Code>SESSION_MAX_AGE_DAYS</Code>, verify refresh token not blacklisted, ensure user account is active</Li>
          <Li><strong>Authentication Loop:</strong> Verify token storage mechanism, check for localStorage/sessionStorage conflicts, review axios interceptor configuration</Li>
          <Li><strong>Rate Limiting Issues:</strong> Check rate limit configuration, verify cache backend connectivity, review IP address detection</Li>
          <Li><strong>2FA Problems:</strong> Verify TOTP secret generation, check time synchronization, review 2FA challenge token validity</Li>
        </Ul>

        <H2>API Integration Examples</H2>
        <H3>Login Request</H3>
        <CodeBlock>POST /api/v1/auth/login/
Content-Type: application/json

{
  "phone_number": "+2348012345678",
  "password": "securepassword123"
}</CodeBlock>

        <H3>Token Refresh Request</H3>
        <CodeBlock>POST /api/v1/auth/token/refresh/
Content-Type: application/json

{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}</CodeBlock>

        <H3>Authenticated Request</H3>
        <CodeBlock>GET /api/v1/users/me/
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...</CodeBlock>
      </div>
    ),
    dashboard: (
      <div>
        <P>The Live Ops Dashboard is the nerve center of the campus operation, providing real-time visibility into fleet status and demand.</P>
        <H2>Real-Time Map</H2>
        <P>Driver locations are tracked via WebSocket. When a driver is <strong>Online</strong>, their app pings the server every 5 seconds. The admin map subscribes to the Redis location channel to animate driver markers.</P>
        <H2>Metrics Overview</H2>
        <Ul>
          <Li><strong>Active Drivers:</strong> Number of drivers currently online and available.</Li>
          <Li><strong>Ongoing Rides:</strong> Number of rides currently in the <Code>in_progress</Code> state.</Li>
          <Li><strong>Unfulfilled Requests:</strong> Rides waiting for a driver match.</Li>
        </Ul>
        <Callout type="warning" title="High Demand Alerts">
          If unfulfilled requests exceed a defined threshold, the dashboard will flash a surge warning, prompting admins to consider activating surge pricing or notifying offline drivers.
        </Callout>
      </div>
    ),
    dispatch: (
      <div>
        <P>The Dispatch Engine handles the logic of matching a rider to the best available driver.</P>
        <H2>Matching Algorithm</H2>
        <Ul>
          <Li><strong>Ping Dispatch:</strong> For standard rides, the system finds the nearest available driver within a 3km radius and sends a "ping" push notification.</Li>
          <Li><strong>Queue Dispatch:</strong> For hub/garage pickups, drivers enter a FIFO (First-In-First-Out) queue. The system assigns the next rider to the driver at the top of the queue.</Li>
        </Ul>
        <H2>Ride Lifecycle States</H2>
        <Ul>
          <Li><Badge>requested</Badge> Passenger has confirmed pickup and destination.</Li>
          <Li><Badge>matched</Badge> Driver has accepted the ping.</Li>
          <Li><Badge>arrived</Badge> Driver is at the pickup location.</Li>
          <Li><Badge>in_progress</Badge> Passenger is in the vehicle.</Li>
          <Li><Badge>completed</Badge> Ride has reached destination and fare is deducted.</Li>
        </Ul>
      </div>
    ),
    operations: (
      <div>
        <P>The Operations Hub is used for manual oversight of routes, fleets, and scheduled rides.</P>
        <H2>Garage Rides</H2>
        <P>Garage rides are scheduled, fixed-route mass transits. The admin can define Routes, set capacities, and issue tickets.</P>
        <H2>Ticketing System</H2>
        <Ul>
          <Li>Students purchase tickets for Garage Rides via the mobile app.</Li>
          <Li>A QR code is generated upon purchase.</Li>
          <Li>Drivers scan the QR code to verify the passenger before boarding.</Li>
        </Ul>
      </div>
    ),
    user_management: (
      <div>
        <P>Centralized table for managing all registered users across the campus.</P>
        <H2>Filtering & Search</H2>
        <P>Admins can filter by role (Student, Driver), account status (Active, Suspended), or search by email/phone number.</P>
        <H2>Account Actions</H2>
        <Ul>
          <Li><strong>Suspend:</strong> Temporarily block access. User JWTs are immediately invalidated.</Li>
          <Li><strong>Ban:</strong> Permanent removal. Requires Super Admin override to undo.</Li>
        </Ul>
      </div>
    ),
    kyc_driver: (
      <div>
        <P>Driver verification is a critical safety component. Drivers cannot go online until approved.</P>
        <H2>Approval Workflow</H2>
        <Ul>
          <Li>Driver submits License, Vehicle Registration, Insurance, and Profile Photo.</Li>
          <Li>Admin reviews documents side-by-side.</Li>
          <Li>If approved, the driver's status changes to <Badge color="#10b981">Verified</Badge>.</Li>
          <Li>If rejected, the admin must provide a reason, which triggers a notification to the driver app.</Li>
        </Ul>
      </div>
    ),
    kyc_student: (
      <div>
        <P>Student verification ensures only enrolled members of the campus can use the service.</P>
        <H2>ID Matching</H2>
        <P>Students must upload their University ID. The admin verifies the ID against the registered name and student number.</P>
      </div>
    ),
    finance: (
      <div>
        <P>The Financial Hub tracks all money moving through the system.</P>
        <H2>Wallet System</H2>
        <P>LR-Ride uses a closed-loop wallet system. Students fund their wallets via Payment Gateways (e.g., Paystack), and ride fares are transferred internally from Student to Driver.</P>
        <H2>Payouts</H2>
        <P>Drivers request withdrawals of their earnings. Admins review and approve these requests in the Payouts tab, which then triggers the API transfer to the driver's bank account.</P>
      </div>
    ),
    fare_engine: (
      <div>
        <P>The Fare Engine dictates how ride prices are calculated.</P>
        <H2>Calculation Formula</H2>
        <P><Code>Fare = Base Fare + (Distance * Per-Km Rate) + (Time * Per-Min Rate)</Code></P>
        <H2>Surge Pricing</H2>
        <P>During peak hours, a Surge Multiplier can be manually or automatically applied to increase fares and incentivize more drivers to go online.</P>
      </div>
    ),
    analytics: (
      <div>
        <P>Data insights for campus operations.</P>
        <H2>Available Reports</H2>
        <Ul>
          <Li><strong>Revenue Trends:</strong> Daily, weekly, and monthly commission totals.</Li>
          <Li><strong>Heatmaps:</strong> Visual representation of high-demand pickup zones.</Li>
          <Li><strong>Utilization:</strong> Average time drivers spend idle vs in-ride.</Li>
        </Ul>
      </div>
    ),
    notifications: (
      <div>
        <P>Manage system-wide alerts and push notifications.</P>
        <H2>Broadcast Composer</H2>
        <P>Admins can write a custom message and target specific audiences (e.g., All Drivers, Verified Students Only).</P>
        <Callout type="info" title="Delivery">
          Notifications are delivered via Firebase Cloud Messaging (FCM) or Expo Push Notifications, depending on the compiled mobile app architecture.
        </Callout>
      </div>
    ),
    settings: (
      <div>
        <P>Global configuration for the campus instance.</P>
        <H2>Map & GIS Configuration</H2>
        <P>Configure the map provider (Google Maps vs Mapbox), adjust routing weights, and define fixed Points of Interest (POIs) that appear on the student app.</P>
        <H2>Integrations</H2>
        <P>Manage API keys for Payment Gateways, SMS providers (for OTPs), and external analytics tools.</P>
      </div>
    ),
    test_lab: (
      <div>
        <P>Developer and Admin tools for verifying system behavior without using real devices.</P>
        <H2>Simulated Rides</H2>
        <P>Create a mock ride request to test dispatch rules and observe WebSocket behavior on the dashboard.</P>
      </div>
    )
  },
  student: {
    student_setup: (
      <div>
        <P>Welcome to LR‑Ride — the student-facing mobile app for secure, campus-only transport. This guide walks you through account setup, verification, payments, requesting rides, and safety best practices.</P>

        <H2>Before you begin</H2>
        <Ul>
          <Li><strong>University affiliation:</strong> You will need a valid university email or student ID for verification.</Li>
          <Li><strong>Device requirements:</strong> Android 8+ or a recent iOS version. A working mobile data or Wi‑Fi connection is required for live tracking and notifications.</Li>
          <Li><strong>Permissions:</strong> Grant location access to get accurate pickup/delivery and allow background location during active rides.</Li>
        </Ul>

        <H2>Create an account</H2>
        <Ul>
          <Li>Install the Student App from your campus distribution or the public app store.</Li>
          <Li>Open the app and tap <strong>Create account</strong>. Provide your full name, phone number, and university email or student number.</Li>
          <Li>Verify your contact by entering the OTP sent to your phone or email.</Li>
          <Li>Complete your profile with a display name and optional photo to help drivers identify you.</Li>
        </Ul>

        <Callout type="info" title="Student verification">
          Students must upload a valid University ID or confirm a university email address. Campus Admins review and approve verification; some features (discounts, Garage rides) require verification.
        </Callout>

        <H2>Security & app lock</H2>
        <P>Set a 4‑digit PIN to protect the app and authorize sensitive actions (top‑ups, cancellations). Where available, enable biometric unlock (FaceID/TouchID) for convenience.</P>

        <H2>Wallet & payments</H2>
        <Ul>
          <Li>Top up your wallet using the integrated payment providers (card, bank transfer, or campus billing where supported).</Li>
          <Li>When you confirm a booking, the estimated fare is placed in escrow and released to the driver after trip completion.</Li>
          <Li>If a payment or webhook fails, the app will notify you and the wallet balance will remain unchanged until resolution.</Li>
        </Ul>

        <H2>Requesting a ride</H2>
        <Ul>
          <Li>Select a pickup point and destination by tapping the map or choosing a saved POI.</Li>
          <Li>Review the fare estimate and confirm the booking. The app shows the vehicle type, ETA, and driver summary when matched.</Li>
          <Li>If no driver accepts within the matching timeout (default 60s), the request will time out and escrowed funds are returned.</Li>
        </Ul>

        <H2>During the ride</H2>
        <Ul>
          <Li>Track the driver's approach in real time. You will see the driver name, vehicle, plate number, and contact options.</Li>
          <Li>Use <strong>Share Ride</strong> to send a live tracking link to friends or family.</Li>
          <Li>Tap the SOS button to immediately alert Campus Admin and trigger the emergency protocol if you feel unsafe.</Li>
        </Ul>

        <H2>Garage rides (scheduled)</H2>
        <P>Browse scheduled garage departures, check seat availability, purchase a ticket, and present the generated QR code for boarding. Garage rides are useful for regular shuttle routes and campus events.</P>

        <H2>Troubleshooting & support</H2>
        <Ul>
          <Li>If you do not receive OTPs, check your network and spam filters; contact Campus Admin if the problem persists.</Li>
          <Li>For lost items, fare disputes, or driver misconduct, open a support ticket from the app and include the ride ID and timestamp.</Li>
          <Li>To report an incident requiring immediate attention, use the SOS flow and follow up with Campus Admin through the support chat.</Li>
        </Ul>

        <Callout type="warning" title="Best practices">
          Keep your profile current and only board drivers whose details match the app. Never share your PIN or verification codes.
        </Callout>

        <H2>Frequently asked questions</H2>
        <Ul>
          <Li><strong>How long does verification take?</strong> Verification is usually completed within 24 hours on business days.</Li>
          <Li><strong>Can I cancel a ride?</strong> Yes. Cancellations before driver arrival are allowed; late cancellations may incur a fee as defined by campus policy.</Li>
          <Li><strong>Where can I see my receipts?</strong> Receipts are available in the app under Ride History and are also sent to your registered email when enabled.</Li>
        </Ul>
      </div>
    ),
    student_home: (
      <div>
        <P>The Dashboard is the landing screen after authentication.</P>
        <H2>Layout Components</H2>
        <Ul>
          <Li><strong>Wallet Balance:</strong> Prominent display of current funds with a quick "Top Up" button.</Li>
          <Li><strong>Active Ride Card:</strong> If a ride is in progress, a persistent card shows the driver's ETA.</Li>
          <Li><strong>Map View:</strong> Displays the campus map with available drivers nearby.</Li>
        </Ul>
      </div>
    ),
    student_booking: (
      <div>
        <P>The core functionality of requesting a ride.</P>
        <H2>Process</H2>
        <Ul>
          <Li>User selects Pickup and Destination (either by dropping a pin or selecting a POI).</Li>
          <Li>System calculates the estimated route and displays the Fare Estimate.</Li>
          <Li>User confirms the booking, which deducts the fare from the wallet into an escrow state.</Li>
        </Ul>
      </div>
    ),
    student_matching: (
      <div>
        <P>The screen shown while waiting for a driver to accept the ping.</P>
        <H2>Timeout Handling</H2>
        <P>If no driver accepts within 60 seconds, the ride request times out, the escrowed funds are returned to the wallet, and the user is prompted to retry.</P>
      </div>
    ),
    student_tracking: (
      <div>
        <P>Live tracking mode during an active ride.</P>
        <H2>Safety Features</H2>
        <Ul>
          <Li><strong>Share Ride:</strong> Generates a tracking link to send to friends.</Li>
          <Li><strong>SOS Button:</strong> Immediately alerts Campus Admin and triggers an emergency protocol.</Li>
        </Ul>
      </div>
    ),
    student_garage: (
      <div>
        <P>Booking scheduled mass transit rides.</P>
        <H2>Browsing Departures</H2>
        <P>Students can view a list of upcoming Garage Rides, checking remaining seat capacity and departure times before purchasing a ticket.</P>
      </div>
    ),
    student_wallet: (
      <div>
        <P>Managing internal funds.</P>
        <H2>Funding</H2>
        <P>Users top up via integrated gateways (e.g., Paystack). The balance updates instantly upon successful webhook receipt.</P>
      </div>
    ),
    student_notifications: (
      <div>
        <P>In-app inbox for system broadcasts, promotional codes, and ride receipts.</P>
      </div>
    ),
    student_profile: (
      <div>
        <P>Profile management and security.</P>
        <H2>App Lock</H2>
        <P>Users can enable FaceID/TouchID or require the 4-digit PIN every time the app is opened to prevent unauthorized ride bookings.</P>
      </div>
    ),
    student_history: (
      <div>
        <P>Archive of past rides.</P>
        <H2>Ratings</H2>
        <P>After a ride completes, the student is prompted to rate the driver out of 5 stars and leave optional feedback.</P>
      </div>
    )
  },
  driver: {
    driver_setup: (
      <div>
        <P>The initial onboarding process for new drivers.</P>
        <H2>Waiting for Approval</H2>
        <P>Unlike students, drivers cannot use the app immediately. They must submit documents and wait for the Campus Admin to approve their KYC application.</P>
      </div>
    ),
    driver_kyc: (
      <div>
        <P>Document submission portal.</P>
        <Callout type="warning" title="Rejections">
          If an admin rejects a document (e.g., blurry photo), the specific document is flagged, and the driver must re-upload only that item.
        </Callout>
      </div>
    ),
    driver_vehicle: (
      <div>
        <P>Registering the physical vehicle.</P>
        <H2>Details Required</H2>
        <P>Make, Model, Year, Color, and License Plate. These details are shown to the student during a ride match for safety verification.</P>
      </div>
    ),
    driver_home: (
      <div>
        <P>The primary interface for accepting work.</P>
        <H2>Online Toggle</H2>
        <P>Drivers must explicitly swipe to go "Online". This initiates the WebSocket connection to broadcast their location and makes them eligible for dispatch pings.</P>
      </div>
    ),
    driver_requests: (
      <div>
        <P>Handling incoming dispatch pings.</P>
        <H2>Acceptance Window</H2>
        <P>When a ping arrives, the driver has 15 seconds to tap Accept. Ignoring the ping counts as a Decline.</P>
        <H2>Cooldown Penalty</H2>
        <P>Declining 3 rides in a row puts the driver in a 5-minute timeout penalty.</P>
      </div>
    ),
    driver_in_ride: (
      <div>
        <P>The workflow while transporting a passenger.</P>
        <H2>Status Progression</H2>
        <Ul>
          <Li><strong>Navigate:</strong> Driver uses built-in or external maps to reach the pickup pin.</Li>
          <Li><strong>Arrived:</strong> Driver taps "I've Arrived", notifying the student.</Li>
          <Li><strong>Start Trip:</strong> Once the student is in the car, the trip officially begins.</Li>
          <Li><strong>End Trip:</strong> Driver taps complete upon reaching the destination, triggering payment processing.</Li>
        </Ul>
      </div>
    ),
    driver_garage: (
      <div>
        <P>For authorized fleet drivers only. Allows creating a scheduled mass-transit ride directly from the driver app.</P>
      </div>
    ),
    driver_wallet: (
      <div>
        <P>Earnings management.</P>
        <H2>Commission</H2>
        <P>Fares are transferred to the driver's wallet minus the Campus Commission percentage configured in the admin settings.</P>
        <H2>Withdrawals</H2>
        <P>Drivers request payouts to their registered bank accounts.</P>
      </div>
    ),
    driver_profile: (
      <div>
        <P>Managing account settings and viewing average rating metrics.</P>
      </div>
    )
  }
};
