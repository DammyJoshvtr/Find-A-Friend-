import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTheme } from "../lib/theme";
import { typography } from "../lib/typography";
import {
  getListings,
  getMySavedDealIds,
  toggleSaveDeal,
  type VendorDeal,
} from "../lib/vendors";

const CATEGORY_ICONS: Record<string, string> = {
  Food: "🍛",
  Print: "🖨️",
  Beauty: "💈",
  Academic: "📚",
  Health: "🏋️",
  Tech: "💻",
  Fashion: "👗",
  Other: "🏪",
};

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#fbbf24",
  Print: "#60a5fa",
  Beauty: "#a78bfa",
  Academic: "#f472b6",
  Health: "#f87171",
  Tech: "#34d399",
  Fashion: "#fb923c",
  Other: "#94a3b8",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#a78bfa";
}

function getCategoryIcon(category: string, vendorIcon?: string | null): string {
  if (vendorIcon) return vendorIcon;
  return CATEGORY_ICONS[category] ?? "🏪";
}

export default function DealsScreen() {
  const theme = useTheme();
  const [deals, setDeals] = useState<VendorDeal[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dealsRes, savedSet] = await Promise.all([
        getListings(),
        getMySavedDealIds(),
      ]);
      setDeals(dealsRes.data ?? []);
      setSavedIds(savedSet);
    } catch {
      Toast.show({ type: "error", text1: "Could not load deals" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleSave = async (deal: VendorDeal) => {
    if (savingId) return;
    setSavingId(deal.id);

    // Optimistic update
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deal.id)) next.delete(deal.id);
      else next.add(deal.id);
      return next;
    });

    const { data, error } = await toggleSaveDeal(deal.id);
    if (error || !data) {
      // Rollback
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (next.has(deal.id)) next.delete(deal.id);
        else next.add(deal.id);
        return next;
      });
      Toast.show({ type: "error", text1: "Could not save deal" });
    }
    setSavingId(null);
  };

  // Derive available categories from live data
  const categories = [
    "All",
    ...Array.from(
      new Set(deals.map((d) => d.vendors?.category ?? "Other").filter(Boolean)),
    ).sort(),
  ];

  const filtered = deals.filter((d) => {
    const cat = d.vendors?.category ?? "Other";
    const matchCat = activeCategory === "All" || cat === activeCategory;
    const matchSearch =
      (d.vendors?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      d.title.toLowerCase().includes(search.toLowerCase());
    // Only show non-expired deals
    const notExpired = !d.valid_until || new Date(d.valid_until) >= new Date();
    return matchCat && matchSearch && notExpired;
  });

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            s.backBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[s.title, { color: theme.text }]}>Campus Deals</Text>
          <Text style={[s.subtitle, { color: theme.textFaint }]}>
            Student-only discounts near you
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View
        style={[
          s.searchBar,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Ionicons name="search-outline" size={15} color={theme.textFaint} />
        <TextInput
          placeholder="Search deals..."
          placeholderTextColor={theme.textFaint}
          style={[
            s.searchInput,
            { color: theme.text, backgroundColor: theme.card },
          ]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category chips */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                s.chip,
                { backgroundColor: theme.card, borderColor: theme.border },
                activeCategory === cat && {
                  backgroundColor: theme.accentBg,
                  borderColor: theme.accentBorder,
                },
              ]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text
                style={[
                  s.chipText,
                  { color: theme.textMuted },
                  activeCategory === cat && {
                    color: theme.accent,
                    fontFamily: typography.fontMedium,
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[s.loadingText, { color: theme.textMuted }]}>
            Loading deals...
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={theme.accent}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🏪</Text>
              <Text style={[s.emptyTitle, { color: theme.text }]}>
                No deals found
              </Text>
              <Text style={[s.emptyText, { color: theme.textMuted }]}>
                {deals.length === 0
                  ? "No vendor deals are available yet. Check back soon!"
                  : "Try a different category or search term."}
              </Text>
            </View>
          ) : (
            filtered.map((deal) => {
              const cat = deal.vendors?.category ?? "Other";
              const color = getCategoryColor(cat);
              const icon = getCategoryIcon(cat, deal.vendors?.icon);
              const isSaved = savedIds.has(deal.id);

              return (
                <View
                  key={deal.id}
                  style={[
                    s.dealCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <View style={s.dealTop}>
                    {/* Icon */}
                    <View
                      style={[
                        s.dealIcon,
                        {
                          backgroundColor: color + "18",
                          borderColor: color + "35",
                        },
                      ]}
                    >
                      <Text style={s.dealIconText}>{icon}</Text>
                    </View>

                    {/* Info */}
                    <View style={s.dealInfo}>
                      <Text
                        style={[s.dealName, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {deal.vendors?.name ?? "Vendor"}
                      </Text>
                      <Text
                        style={[s.dealLocation, { color: theme.textFaint }]}
                        numberOfLines={1}
                      >
                        📍 {deal.vendors?.location_text ?? ""}
                      </Text>
                      <Text
                        style={[s.dealTitle, { color: color }]}
                        numberOfLines={2}
                      >
                        {deal.title}
                      </Text>
                    </View>

                    {/* Discount badge */}
                    <View
                      style={[
                        s.discountBadge,
                        {
                          backgroundColor: color + "18",
                          borderColor: color + "35",
                        },
                      ]}
                    >
                      <Text style={[s.discountText, { color }]}>
                        {deal.discount}
                      </Text>
                    </View>
                  </View>

                  {/* Footer */}
                  <View
                    style={[s.dealFooter, { borderTopColor: theme.border2 }]}
                  >
                    <View style={s.redeemWrap}>
                      <Text style={[s.redeemLabel, { color: theme.textFaint }]}>
                        How to redeem:
                      </Text>
                      <Text
                        style={[s.redeemText, { color: theme.textMuted }]}
                        numberOfLines={1}
                      >
                        {deal.how_to_redeem}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        s.saveBtn,
                        { borderColor: theme.border },
                        isSaved && {
                          backgroundColor: color + "20",
                          borderColor: color,
                        },
                      ]}
                      onPress={() => handleToggleSave(deal)}
                      disabled={savingId === deal.id}
                    >
                      {savingId === deal.id ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <Text
                          style={[
                            s.saveText,
                            { color: isSaved ? color : theme.textMuted },
                          ]}
                        >
                          {isSaved ? "✓ Saved" : "🔖 Save"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Expiry warning */}
                  {deal.valid_until && (
                    <Text style={[s.expiry, { color: theme.textFaint }]}>
                      Expires{" "}
                      {new Date(deal.valid_until).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  title: { fontSize: 16, fontFamily: typography.fontBold },
  subtitle: { fontSize: 10, fontFamily: typography.fontRegular },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 0.5,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: typography.fontRegular },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  chipText: { fontSize: 12, fontFamily: typography.fontRegular },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontFamily: typography.fontRegular },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontFamily: typography.fontSemiBold },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    fontFamily: typography.fontRegular,
    lineHeight: 20,
  },
  dealCard: {
    marginBottom: 10,
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
  },
  dealTop: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  dealIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    flexShrink: 0,
  },
  dealIconText: { fontSize: 24 },
  dealInfo: { flex: 1, minWidth: 0 },
  dealName: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    marginBottom: 2,
  },
  dealLocation: {
    fontSize: 11,
    fontFamily: typography.fontRegular,
    marginBottom: 3,
  },
  dealTitle: {
    fontSize: 13,
    fontFamily: typography.fontMedium,
    lineHeight: 18,
  },
  discountBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 0.5,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  discountText: { fontSize: 12, fontFamily: typography.fontBold },
  dealFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 0.5,
  },
  redeemWrap: { flex: 1, minWidth: 0, marginRight: 8 },
  redeemLabel: {
    fontSize: 10,
    fontFamily: typography.fontRegular,
    marginBottom: 2,
  },
  redeemText: { fontSize: 12, fontFamily: typography.fontMedium },
  saveBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 0.5,
    minWidth: 70,
    alignItems: "center",
  },
  saveText: { fontSize: 12, fontFamily: typography.fontMedium },
  expiry: {
    fontSize: 10,
    fontFamily: typography.fontRegular,
    marginTop: 6,
    textAlign: "right",
  },
});
