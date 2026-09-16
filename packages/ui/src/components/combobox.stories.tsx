import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Combobox } from './data';

const districts = [
  { value: 'vake', label: 'ვაკე', hint: '412 ფართი' },
  { value: 'saburtalo', label: 'საბურთალო', hint: '538 ფართი' },
  { value: 'mtatsminda', label: 'მთაწმინდა', hint: '190 ფართი' },
  { value: 'didube', label: 'დიდუბე', hint: '221 ფართი' },
  { value: 'isani', label: 'ისანი', hint: '164 ფართი' },
  { value: 'gldani', label: 'გლდანი', hint: '98 ფართი' },
];

const meta = { title: 'Components/Combobox', component: Combobox, args: { options: districts, label: 'უბანი', placeholder: 'მაგ.: ვაკე', onChange: () => undefined } } satisfies Meta<typeof Combobox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<string | null>('vake');
    return (
      <div className="max-w-xs">
        <Combobox {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};
