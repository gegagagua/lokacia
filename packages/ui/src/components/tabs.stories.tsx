import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs } from './overlay';
import { SpecRow } from './display';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  args: {
    tabs: [
      {
        value: 'passport',
        label: 'ტექნიკური პასპორტი',
        content: (
          <div className="max-w-md">
            <SpecRow label="ფართობი" value="64" unit="მ²" />
            <SpecRow label="ჭერის სიმაღლე" value="3,4" unit="მ" />
            <SpecRow label="ელექტროენერგია" value="25" unit="კვტ" />
          </div>
        ),
      },
      { value: 'history', label: 'ისტორია', count: 3, content: <p className="text-muted">ბოლო 3 წელში ფართში 3 ბიზნესი ჩაიხურა.</p> },
      { value: 'costs', label: 'ხარჯების კალკულატორი', content: <p className="text-muted">თვიური ხარჯი: დაახლ. 5 200 ₾.</p> },
    ],
  },
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
