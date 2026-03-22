import { createServiceClient } from '@/lib/supabase/server';
import { PunchFlow } from '@/components/PunchFlow';
import { Staff } from '@/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createServiceClient();
  const { data: staffList } = await supabase
    .from('staff')
    .select('*')
    .order('display_order', { ascending: true });

  return <PunchFlow staffList={(staffList as Staff[]) ?? []} />;
}
