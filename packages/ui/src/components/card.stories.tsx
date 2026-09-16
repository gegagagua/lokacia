import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, SectionTitle, Stat } from './display';
import { Button } from './button';

const meta = { title: 'Components/Card', component: Card } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md p-5">
      <h3 className="text-h3 font-semibold">ვერიფიცირებული მესაკუთრე</h3>
      <p className="mt-2 text-muted">ატვირთეთ ამონაწერი საჯარო რეესტრიდან — ვერიფიკაცია 1 სამუშაო დღეში.</p>
      <Button className="mt-4" variant="secondary">
        ამონაწერის ატვირთვა
      </Button>
    </Card>
  ),
};
export const Stats: Story = {
  render: () => (
    <div>
      <SectionTitle title="ბაზრის მიმოხილვა" subtitle="თბილისი, სექტემბერი 2026" action={<Button variant="link">დეტალურა</Button>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="აქტიური ფართები" value="3 482" hint="+4% თვეში" />
        <Stat label="საშ. ფასი / მ²" value="38 ₾" hint="ვაკე, კაფე" />
        <Stat label="საშ. ვადა" value="41 დღე" />
      </div>
    </div>
  ),
};
