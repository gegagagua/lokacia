import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pagination } from './data';

const meta = { title: 'Components/Pagination', component: Pagination, args: { page: 4, pages: 18, onPage: () => undefined } } satisfies Meta<typeof Pagination>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: (args) => {
    const [page, setPage] = React.useState(args.page);
    return <Pagination pages={args.pages} page={page} onPage={setPage} />;
  },
};
export const FirstPage: Story = { args: { page: 1, pages: 5 } };
