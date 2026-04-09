import React from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { FormField, Input, Select } from '@/components/ui/Input'

export function ReportControls({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  basis,
  onChangeBasis,
  showBasis = true,
  onExport,
  extra
}) {
  return (
    <Card className="mb-4">
      <CardBody className="flex flex-col md:flex-row gap-3 items-end">
        <FormField label="Start Date">
          <Input type="date" value={startDate} onChange={(e) => onChangeStart(e.target.value)} />
        </FormField>
        <FormField label="End Date">
          <Input type="date" value={endDate} onChange={(e) => onChangeEnd(e.target.value)} />
        </FormField>
        {showBasis && (
          <FormField label="Basis">
            <Select value={basis} onChange={(e) => onChangeBasis(e.target.value)}>
              <option value="accrual">Accrual</option>
              <option value="cash">Cash</option>
            </Select>
          </FormField>
        )}
        {extra}
        <div className="flex gap-2 flex-1 justify-end">
          {onExport && (
            <Button variant="outline" onClick={onExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

export function usePeriodDefaults() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end = now.toISOString().slice(0, 10)
  return { start, end }
}
