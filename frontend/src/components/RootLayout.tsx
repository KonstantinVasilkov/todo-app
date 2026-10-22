import { Outlet } from '@tanstack/react-router'
import { ReloginDialog } from '../auth/ReloginDialog'

export function RootLayout() {
  return (
    <>
      <Outlet />
      <ReloginDialog />
    </>
  )
}
