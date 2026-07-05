import { Navigate, Outlet, useSearchParams } from 'react-router-dom'

const SECRET_TOKEN = 'LzR_Secure_App_2026'

export default function WebViewGuard() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  // If the token is missing or incorrect, we return null so the page is completely blank.
  // Alternatively, we could redirect to /login or a 404 page.
  if (token !== SECRET_TOKEN) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
        404 Not Found
      </div>
    )
  }

  // If the token is correct, render the webview page
  return <Outlet />
}
