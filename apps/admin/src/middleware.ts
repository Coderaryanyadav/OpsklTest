import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith('/api');

  // Allow static assets, next internals, and public endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/login'
  ) {
    return response;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;


  // If live credentials are not configured:
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    if (isApiRoute) {
      return NextResponse.json(
        { success: false, error: 'Supabase credentials are not configured.' },
        { status: 500 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'missing_configuration');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      if (isApiRoute) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Admin authentication required.' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      // Transfer updated cookies from setAll (if any)
      response.cookies.getAll().forEach((c) => {
        redirectResponse.cookies.set(c.name, c.value, c);
      });
      // If error or invalid session, clear any existing auth token cookies to stop repeated refresh token loops
      if (error) {
        request.cookies.getAll().forEach((cookie) => {
          if (cookie.name.includes('-auth-token') || cookie.name.startsWith('sb-')) {
            redirectResponse.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
          }
        });
      }
      return redirectResponse;
    }

    // Server-side verification that authenticated session is an active admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'admin' || !profile.is_active) {
      if (isApiRoute) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Active admin privileges required.' },
          { status: 403 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'unauthorized_role');
      const redirectResponse = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach((c) => {
        redirectResponse.cookies.set(c.name, c.value, c);
      });
      return redirectResponse;
    }
  } catch {
    if (isApiRoute) {
      return NextResponse.json(
        { success: false, error: 'Authentication verification error.' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.includes('-auth-token') || cookie.name.startsWith('sb-')) {
        redirectResponse.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
      }
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
