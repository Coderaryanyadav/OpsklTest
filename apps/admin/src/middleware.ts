import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exclude assets, Next internals, api, and login
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/login'
  ) {
    return NextResponse.next();
  }

  // Check for presence of Supabase auth cookies
  const hasAuthToken =
    request.cookies.has('sb-access-token') ||
    request.cookies.has('sb-refresh-token') ||
    request.cookies.has('supabase-auth-token');

  // Enforce server-side route boundary
  if (!hasAuthToken && process.env.NODE_ENV === 'production') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
