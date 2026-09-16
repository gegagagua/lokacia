import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stepper } from './display';

const steps = ['ტიპი', 'ლოკაცია', 'პასპორტი', 'ფოტოები', 'ფასი', 'გადახედვა'];
const meta = { title: 'Components/Stepper', component: Stepper, args: { steps, current: 2 } } satisfies Meta<typeof Stepper>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ListingWizard: Story = {
  render: (args) => {
    const [current, setCurrent] = React.useState(args.current);
    return <Stepper steps={args.steps} current={current} onStepClick={setCurrent} />;
  },
};
export const Start: Story = { args: { current: 0 } };
