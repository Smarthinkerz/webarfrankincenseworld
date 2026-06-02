import { redirect } from 'next/navigation';

const DEFAULT_SCAN_ROUTE = '/scan/purewells-wacandy-japan';

export default function RootPage() {
  redirect(DEFAULT_SCAN_ROUTE);
}
