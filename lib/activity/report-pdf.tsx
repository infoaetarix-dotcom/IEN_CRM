import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { PdfLogo } from '@/lib/branding/pdf-logo';
import type { ActivityEntry } from './types';

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
  colDate: { width: '14%', paddingRight: 6 },
  colCategory: { width: '18%', paddingRight: 6 },
  colTitle: { width: '30%', paddingRight: 6 },
  colDescription: { width: '38%' },
  empty: { marginTop: 16, color: '#6B7280', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 24, left: 32, right: 32, textAlign: 'center', fontSize: 7, color: '#9CA3AF' },
});

export function ActivityReportDocument({
  entries,
  orgName,
  logo,
  navyHex,
  accentHex,
  rangeLabel,
}: {
  entries: ActivityEntry[];
  orgName: string;
  logo: PdfLogo | null;
  navyHex: string;
  accentHex: string;
  rangeLabel: string;
}) {
  const byCategory = new Map<string, number>();
  for (const e of entries) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1);
  const topCategory =
    [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: navyHex }]}>
          <View>
            {logo && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={{ data: logo.data, format: logo.format }}
                style={styles.logo}
              />
            )}
            <Text style={styles.title}>{orgName} — Activity Report</Text>
            <Text style={styles.subtitle}>{rangeLabel} · Powered by Aetarix</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total activities</Text>
            <Text style={[styles.summaryValue, { color: navyHex }]}>{entries.length}</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: `${accentHex}22`, marginRight: 0 }]}>
            <Text style={styles.summaryLabel}>Most common category</Text>
            <Text style={[styles.summaryValue, { color: navyHex }]}>{topCategory}</Text>
          </View>
        </View>

        <View style={[styles.tableHeaderRow, { borderBottomColor: navyHex }]}>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colCategory}>Category</Text>
          <Text style={styles.colTitle}>Title</Text>
          <Text style={styles.colDescription}>Description</Text>
        </View>
        {entries.map((e) => (
          <View key={e.id} style={styles.tableRow}>
            <Text style={styles.colDate}>{new Date(e.activity_date).toLocaleDateString('en-GB')}</Text>
            <Text style={styles.colCategory}>{e.category}</Text>
            <Text style={styles.colTitle}>{e.title}</Text>
            <Text style={styles.colDescription}>{e.description ?? ''}</Text>
          </View>
        ))}
        {entries.length === 0 && <Text style={styles.empty}>No activity logged in this period.</Text>}

        <Text style={styles.footer} fixed>
          Generated {new Date().toLocaleString('en-GB')} · Powered by Aetarix
        </Text>
      </Page>
    </Document>
  );
}
