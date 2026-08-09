import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { FinanceEntry } from './types';

/** Raw image bytes — never a bare URL/path string, see route.tsx for why. */
export interface StatementLogo {
  data: Buffer;
  format: 'png' | 'jpg';
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#111827' },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 2 },
  logo: { height: 30, width: 90, objectFit: 'contain', marginBottom: 8 },
  title: { fontSize: 15, fontWeight: 700 },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 3 },
  summaryRow: { flexDirection: 'row', marginBottom: 20 },
  summaryBox: { flex: 1, padding: 10, borderRadius: 4, backgroundColor: '#F3F4F6', marginRight: 10 },
  summaryLabel: { fontSize: 7, textTransform: 'uppercase', color: '#6B7280', letterSpacing: 1 },
  summaryValue: { fontSize: 13, fontWeight: 700, marginTop: 4 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 6, fontWeight: 700 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 6 },
  colDate: { width: '13%', paddingRight: 6 },
  colType: { width: '11%', paddingRight: 6 },
  colAmount: { width: '16%', textAlign: 'right', paddingRight: 8 },
  colCategory: { width: '16%', paddingRight: 6 },
  colPayment: { width: '14%', paddingRight: 6 },
  colLead: { width: '14%', paddingRight: 6 },
  colNote: { width: '16%' },
  empty: { marginTop: 16, color: '#6B7280', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 24, left: 32, right: 32, textAlign: 'center', fontSize: 7, color: '#9CA3AF' },
});

export function StatementDocument({
  entries,
  fullName,
  role,
  orgName,
  logo,
  navyHex,
  accentHex,
  rangeLabel,
}: {
  entries: FinanceEntry[];
  fullName: string;
  role: string;
  orgName: string;
  logo: StatementLogo | null;
  navyHex: string;
  accentHex: string;
  rangeLabel: string;
}) {
  const totalIncome = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;
  const roleLabel = role === 'admin' ? 'Admin' : 'Agent';
  const money = (n: number) => `Rs ${n.toLocaleString('en-US')}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: navyHex }]}>
          <View>
            {/* react-pdf's Image is a PDF primitive, not a DOM <img> — no alt prop exists. */}
            {logo && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={{ data: logo.data, format: logo.format }}
                style={styles.logo}
              />
            )}
            <Text style={styles.title}>
              {fullName} — {roleLabel} Finance Statement
            </Text>
            <Text style={styles.subtitle}>
              {orgName} · {rangeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total income</Text>
            <Text style={[styles.summaryValue, { color: '#047857' }]}>{money(totalIncome)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total expense</Text>
            <Text style={[styles.summaryValue, { color: '#B91C1C' }]}>{money(totalExpense)}</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: `${accentHex}22`, marginRight: 0 }]}>
            <Text style={styles.summaryLabel}>Net balance</Text>
            <Text style={[styles.summaryValue, { color: navyHex }]}>{money(balance)}</Text>
          </View>
        </View>

        <View style={[styles.tableHeaderRow, { borderBottomColor: navyHex }]}>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colType}>Type</Text>
          <Text style={styles.colAmount}>Amount</Text>
          <Text style={styles.colCategory}>Category</Text>
          <Text style={styles.colPayment}>Payment</Text>
          <Text style={styles.colLead}>Lead</Text>
          <Text style={styles.colNote}>Note</Text>
        </View>
        {entries.map((e) => (
          <View key={e.id} style={styles.tableRow}>
            <Text style={styles.colDate}>{new Date(e.entry_date).toLocaleDateString('en-GB')}</Text>
            <Text style={styles.colType}>{e.type === 'income' ? 'Income' : 'Expense'}</Text>
            <Text style={[styles.colAmount, { color: e.type === 'income' ? '#047857' : '#B91C1C' }]}>
              {e.type === 'income' ? '+' : '-'} {money(e.amount)}
            </Text>
            <Text style={styles.colCategory}>{e.category}</Text>
            <Text style={styles.colPayment}>{e.payment_method ?? '—'}</Text>
            <Text style={styles.colLead}>{e.lead_name ?? '—'}</Text>
            <Text style={styles.colNote}>{e.note ?? ''}</Text>
          </View>
        ))}
        {entries.length === 0 && <Text style={styles.empty}>No entries in this period.</Text>}

        <Text style={styles.footer} fixed>
          Generated {new Date().toLocaleString('en-GB')} · Powered by Aetarix
        </Text>
      </Page>
    </Document>
  );
}
