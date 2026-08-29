import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Company } from '../types';

interface CompanyChartProps {
  company: Company;
}

export const CompanyChart: React.FC<CompanyChartProps> = ({ company }) => {
  const data = company.priceHistory.map((price, index) => ({
    round: index === 0 ? '시작' : `R${index}`,
    price: price,
  }));

  return (
    <div className="w-full h-[180px] bg-white rounded-xl border border-black/10 p-2 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DFE6E9" />
          <XAxis 
            dataKey="round" 
            tick={{ fontSize: 10, fill: '#636E72', fontWeight: 600 }}
            axisLine={{ stroke: '#DFE6E9' }}
            tickLine={false}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            tick={{ fontSize: 10, fill: '#636E72' }} 
            tickFormatter={(value) => `${value.toLocaleString()}`}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '2px solid black', fontSize: '12px', fontWeight: 'bold' }}
            formatter={(value: number) => [`${value.toLocaleString()}원`, '주가']}
            labelStyle={{ color: '#636E72', marginBottom: '4px' }}
          />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke={company.color} 
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: company.color }}
            activeDot={{ r: 6, fill: company.color, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
