import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { FiveSPhase } from '../types/fiveSTypes';

interface Props {
  phaseScores: Record<FiveSPhase, number>; // Scores 0 - 100
  targetScore?: number;
  height?: number;
}

export const FiveSRadarChart: React.FC<Props> = ({
  phaseScores,
  targetScore = 80,
  height = 280
}) => {
  const data = [
    { subject: '1S Seiri', actual: phaseScores['1S'] || 0, target: targetScore, fullMark: 100 },
    { subject: '2S Seiton', actual: phaseScores['2S'] || 0, target: targetScore, fullMark: 100 },
    { subject: '3S Seiso', actual: phaseScores['3S'] || 0, target: targetScore, fullMark: 100 },
    { subject: '4S Seiketsu', actual: phaseScores['4S'] || 0, target: targetScore, fullMark: 100 },
    { subject: '5S Shitsuke', actual: phaseScores['5S'] || 0, target: targetScore, fullMark: 100 },
  ];

  return (
    <div className="w-full flex flex-col items-center">
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
            />
            <Radar
              name="Objetivo"
              dataKey="target"
              stroke="#94a3b8"
              strokeDasharray="3 3"
              fill="#94a3b8"
              fillOpacity={0.1}
            />
            <Radar
              name="Actual"
              dataKey="actual"
              stroke="#2563eb"
              fill="#3b82f6"
              fillOpacity={0.45}
            />
            <Tooltip
              formatter={(value: any) => [`${value}%`, '']}
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 text-xs text-gray-500 mt-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-500 rounded-xs inline-block" />
          <span className="font-medium text-gray-700">Puntuación Actual</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-1 bg-gray-400 border-t border-dashed border-gray-400 inline-block" />
          <span className="font-medium text-gray-500">Objetivo ({targetScore}%)</span>
        </div>
      </div>
    </div>
  );
};
