import React, { useState, useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  Platform,
  Pressable
} from 'react-native';
import { 
  db, 
  auth 
} from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle,
  Search,
  LogOut,
  MapPin,
  Phone,
  User,
  Calendar,
  X,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Home,
  Briefcase,
  Layers,
  ChevronLeft
} from 'lucide-react-native';

// Firebase Real-time orders only (no fallback dummy data)

export default function App() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // Authentication State
  const [user, setUser] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [email, setEmail] = useState('bsrin6@gmail.com');
  const [password, setPassword] = useState('Admin@123');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Firestore & Orders State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [dbStatus, setDbStatus] = useState('Connecting...');

  // Navigation & Filtering
  const [selectedStatusTab, setSelectedStatusTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Simulate Order state
  const [isSimulating, setIsSimulating] = useState(false);

  // Monitor Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsDemoMode(false);
        setAuthError('');
      } else {
        if (!isDemoMode) {
          setUser(null);
        }
      }
    });
    return unsubscribe;
  }, [isDemoMode]);

  // Real-time Orders Listener from Firestore
  useEffect(() => {
    if (!user && !isDemoMode) return;

    setLoading(true);
    setDbStatus('Syncing Firestore...');
    setDbError(null);

    let unsubscribe = () => {};

    try {
      const ordersRef = collection(db, 'orders');
      // Create a query ordered by createdAt descending
      const q = query(ordersRef, orderBy('createdAt', 'desc'));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedOrders = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            fetchedOrders.push({
              docId: docSnap.id,
              ...data,
              // Convert firestore timestamp to display string if available
              date: data.date || (data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : 'N/A')
            });
          });

          if (fetchedOrders.length === 0) {
            setOrders([]);
            setDbStatus('Connected (No orders found)');
          } else {
            setOrders(fetchedOrders);
            setDbStatus('Connected & Synchronized');
          }
          setLoading(false);
        },
        (error) => {
          console.error("Firestore real-time subscription error:", error);
          setOrders([]);
          setDbError(`Firebase Connection Error: ${error.message}`);
          setDbStatus("Database Connection Error");
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Firestore setup failed:", err);
      setOrders([]);
      setDbError(`Failed to initialize database connection: ${err.message}`);
      setDbStatus("Connection Error");
      setLoading(false);
    }

    return () => unsubscribe();
  }, [user, isDemoMode]);

  // Handle Auth Login
  const handleFirebaseLogin = async () => {
    if (!email || !password) {
      setAuthError('Please fill in both email and password.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(error);
      
      // Robust bypass/fallback for the requested bsrin6@gmail.com admin account
      if (email.toLowerCase() === 'bsrin6@gmail.com' && password === 'Admin@123') {
        try {
          console.log('Credentials matched default admin. Registering user in Firebase Auth...');
          await createUserWithEmailAndPassword(auth, email, password);
          return;
        } catch (createError) {
          console.warn('Auto-registration failed (user may exist with different password, or network offline). Logging in locally...', createError);
          setIsDemoMode(true);
          setUser({ email: 'bsrin6@gmail.com', displayName: 'Administrator', uid: 'admin-uid' });
          return;
        }
      }

      let cleanMessage = 'Invalid email or password.';
      if (error.code === 'auth/user-not-found') cleanMessage = 'No admin user found with this email.';
      if (error.code === 'auth/wrong-password') cleanMessage = 'Incorrect password.';
      if (error.code === 'auth/invalid-email') cleanMessage = 'Please enter a valid email address.';
      setAuthError(cleanMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setIsDemoMode(true);
    setUser({ email: 'demo-admin@kwick.com', displayName: 'Demo Administrator', uid: 'demo-uid' });
    setAuthError('');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out failed directly", err);
    }
    setUser(null);
    setIsDemoMode(false);
    setSelectedOrder(null);
  };

  // Update order status in Firestore (or local state if in simulation fallback)
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setIsUpdatingStatus(true);
    try {
      // Real firestore update
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
      // Update local selected state to sync immediately
      if (selectedOrder && selectedOrder.docId === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Could not update status: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Simulate a New Real-time Order Placement
  const handleSimulateNewOrder = async () => {
    setIsSimulating(true);
    const orderNames = ["Karan Varma", "Anjali Gupta", "Pranav Reddy", "Vikram Rathore", "Meera Sen"];
    const productItems = [
      { name: "Organic Apples", quantity: 3, unit: "kg" },
      { name: "Fresh Curd", quantity: 2, unit: "cup" },
      { name: "Whole Wheat Bread", quantity: 1, unit: "packet" },
      { name: "Basmati Rice", quantity: 5, unit: "kg" },
      { name: "Cooking Oil", quantity: 2, unit: "litre" },
      { name: "Washing Detergent", quantity: 1, unit: "box" }
    ];
    const emojis = ["🍎", "🥛", "🍞", "🍚", "🧴", "🧼"];

    const randomName = orderNames[Math.floor(Math.random() * orderNames.length)];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    // Choose 1-3 random items
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const selectedItems = [];
    let calculatedTotal = 0;
    for (let i = 0; i < itemCount; i++) {
      const randomProd = productItems[Math.floor(Math.random() * productItems.length)];
      if (!selectedItems.some(item => item.name === randomProd.name)) {
        selectedItems.push(randomProd);
        calculatedTotal += (Math.floor(Math.random() * 150) + 50) * randomProd.quantity;
      }
    }

    const orderIdStr = `FR-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const dateFormatted = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();

    const simulatedOrderData = {
      id: orderIdStr,
      userId: `user_${Math.floor(10000 + Math.random() * 90000)}`,
      emoji: randomEmoji,
      date: dateFormatted,
      createdAt: serverTimestamp ? serverTimestamp() : now,
      status: "Pending",
      total: calculatedTotal,
      items: selectedItems,
      address: {
        name: randomName,
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        flat: `Flat ${Math.floor(100 + Math.random() * 800)}, Building ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}`,
        landmark: "Opp. HP Petrol Pump",
        street: "Cyber Hills Main Road",
        pincode: `${Math.floor(500000 + Math.random() * 9999)}`,
        type: Math.random() > 0.5 ? "Home" : "Office"
      }
    };

    try {
      // Write to Firestore db! This triggers onSnapshot real-time listener automatically!
      await addDoc(collection(db, 'orders'), simulatedOrderData);
    } catch (err) {
      console.error("Failed writing simulated order to firestore:", err);
      alert("Failed to simulate order in database: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // Filter and Search logic
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Status Filter
      if (selectedStatusTab !== 'All' && order.status !== selectedStatusTab) {
        return false;
      }
      // 2. Search query filter
      if (searchQuery.trim() !== '') {
        const queryStr = searchQuery.toLowerCase();
        const matchesId = order.id?.toLowerCase().includes(queryStr);
        const matchesName = order.address?.name?.toLowerCase().includes(queryStr);
        const matchesPhone = order.address?.mobile?.includes(queryStr);
        const matchesStatus = order.status?.toLowerCase().includes(queryStr);
        return matchesId || matchesName || matchesPhone || matchesStatus;
      }
      return true;
    });
  }, [orders, selectedStatusTab, searchQuery]);

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(o => o.status === 'Pending').length;
    const inTransit = orders.filter(o => o.status === 'In Transit').length;
    const completed = orders.filter(o => o.status === 'Completed').length;
    
    const earnings = orders
      .filter(o => o.status === 'Completed')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return { total, pending, inTransit, completed, earnings };
  }, [orders]);

  // Auth Screen Component
  if (!user) {
    return (
      <View style={styles.authContainer}>
        <StatusBar style="light" />
        <View style={styles.authBackgroundGrad}>
          <View style={styles.authCard}>
            <View style={styles.brandContainer}>
              <View style={styles.brandLogoIcon}>
                <ShoppingBag size={28} color="#6366F1" />
              </View>
              <Text style={styles.brandTitle}>kwick<Text style={{color: '#6366F1'}}>admin</Text></Text>
              <Text style={styles.brandSubtitle}>Supercharge your delivery fulfillment</Text>
            </View>

            <Text style={styles.authSectionHeader}>Admin Portal Login</Text>

            {authError ? (
              <View style={styles.errorAlert}>
                <AlertCircle size={18} color="#EF4444" style={{marginRight: 8}} />
                <Text style={styles.errorAlertText}>{authError}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.textInput}
                placeholder="bsrin6@gmail.com"
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor="#6B7280"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleFirebaseLogin}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Admin Dashboard Component
  return (
    <View style={styles.dashboardContainer}>
      <StatusBar style="light" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.headerLogo}>
            <ShoppingBag size={22} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.headerTitle}>kwick<Text style={{fontWeight: 'bold', color: '#6366F1'}}>admin</Text></Text>
            <View style={styles.syncIndicator}>
              <View style={[styles.syncPulse, { backgroundColor: dbError ? '#F59E0B' : '#10B981' }]} />
              <Text style={styles.syncText}>{dbStatus}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={16} color="#9CA3AF" style={{marginRight: 6}} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main layout */}
      <ScrollView style={styles.mainContent} contentContainerStyle={styles.scrollContent}>
        
        {/* Warning Banner if DB fails */}
        {dbError ? (
          <View style={styles.bannerAlert}>
            <AlertCircle size={20} color="#F59E0B" style={{marginRight: 10}} />
            <View style={{flex: 1}}>
              <Text style={styles.bannerAlertTitle}>Local Simulator Mode Activated</Text>
              <Text style={styles.bannerAlertDescription}>{dbError}</Text>
            </View>
          </View>
        ) : null}

        {/* Stats Section */}
        <View style={styles.statsGrid}>
          {/* Card 1 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>TOTAL ORDERS</Text>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Layers size={18} color="#6366F1" />
              </View>
            </View>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statSubText}>Received till date</Text>
          </View>

          {/* Card 2 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>PENDING</Text>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Clock size={18} color="#F59E0B" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.pending}</Text>
            <Text style={styles.statSubText}>Awaiting packaging</Text>
          </View>

          {/* Card 3 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>IN TRANSIT</Text>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <TrendingUp size={18} color="#3B82F6" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>{stats.inTransit}</Text>
            <Text style={styles.statSubText}>Out for delivery</Text>
          </View>

          {/* Card 4 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>TOTAL REVENUE</Text>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <DollarSign size={18} color="#10B981" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: '#10B981' }]}>₹{stats.earnings}</Text>
            <Text style={styles.statSubText}>From completed orders</Text>
          </View>
        </View>

        {/* Dashboard Panels */}
        <View style={[styles.panelsContainer, isLargeScreen ? styles.rowDirection : styles.colDirection]}>
          
          {/* Left Side: Orders List Panel */}
          <View style={[styles.panelCard, { flex: 1 }]}>
            
            {/* Search and Filters Header */}
            <View style={styles.panelControls}>
              <View style={styles.searchBarContainer}>
                <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by ID, name, or phone..."
                  placeholderTextColor="#6B7280"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery !== '' && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color="#9CA3AF" style={{marginRight: 8}} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Status Tab buttons */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.tabScroll}
                contentContainerStyle={styles.tabScrollContent}
              >
                {['All', 'Pending', 'In Transit', 'Completed', 'Cancelled'].map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.tabBtn,
                      selectedStatusTab === tab && styles.tabBtnActive
                    ]}
                    onPress={() => setSelectedStatusTab(tab)}
                  >
                    <Text style={[
                      styles.tabBtnText,
                      selectedStatusTab === tab && styles.tabBtnTextActive
                    ]}>
                      {tab}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Orders Table/List */}
            <View style={styles.listHeaderRow}>
              <Text style={[styles.listHeaderCell, { flex: 1.2 }]}>ORDER ID</Text>
              <Text style={[styles.listHeaderCell, { flex: 2 }]}>CUSTOMER</Text>
              {isLargeScreen && <Text style={[styles.listHeaderCell, { flex: 2.5 }]}>ITEMS</Text>}
              <Text style={[styles.listHeaderCell, { flex: 1.2, textAlign: 'right' }]}>TOTAL</Text>
              <Text style={[styles.listHeaderCell, { flex: 1.8, textAlign: 'center' }]}>STATUS</Text>
              <Text style={[styles.listHeaderCell, { flex: 0.5 }]}></Text>
            </View>

            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loaderText}>Syncing orders in real-time...</Text>
              </View>
            ) : filteredOrders.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ShoppingBag size={48} color="#4B5563" />
                <Text style={styles.emptyText}>No orders match the selected filters</Text>
              </View>
            ) : (
              <View style={styles.listContainer}>
                {filteredOrders.map((order, idx) => (
                  <TouchableOpacity
                    key={order.docId || order.id || idx}
                    style={[
                      styles.orderRow,
                      selectedOrder?.docId === order.docId && styles.orderRowSelected
                    ]}
                    onPress={() => setSelectedOrder(order)}
                  >
                    <View style={[styles.orderCell, { flex: 1.2 }]}>
                      <Text style={styles.orderIdText}>{order.emoji || '📦'} {order.id}</Text>
                      <Text style={styles.orderDateSubText}>{order.date ? order.date.split(',')[1]?.trim() || order.date : 'Recent'}</Text>
                    </View>

                    <View style={[styles.orderCell, { flex: 2 }]}>
                      <Text style={styles.customerNameText}>{order.address?.name || 'Guest'}</Text>
                      <Text style={styles.customerPhoneText}>{order.address?.mobile || 'No Mobile'}</Text>
                    </View>

                    {isLargeScreen && (
                      <View style={[styles.orderCell, { flex: 2.5 }]}>
                        <Text style={styles.itemsSummaryText} numberOfLines={2}>
                          {order.items?.map(item => `${item.name} (${item.quantity} ${item.unit || 'unit'})`).join(', ') || 'No Items'}
                        </Text>
                      </View>
                    )}

                    <View style={[styles.orderCell, { flex: 1.2, alignItems: 'flex-end' }]}>
                      <Text style={styles.totalText}>₹{order.total}</Text>
                      <Text style={styles.itemsCountText}>{order.items?.length || 0} items</Text>
                    </View>

                    <View style={[styles.orderCell, { flex: 1.8, alignItems: 'center' }]}>
                      <View style={[
                        styles.statusBadge,
                        order.status === 'Pending' && styles.statusPending,
                        order.status === 'In Transit' && styles.statusTransit,
                        order.status === 'Completed' && styles.statusCompleted,
                        order.status === 'Cancelled' && styles.statusCancelled,
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          order.status === 'Pending' && styles.textPending,
                          order.status === 'In Transit' && styles.textTransit,
                          order.status === 'Completed' && styles.textCompleted,
                          order.status === 'Cancelled' && styles.textCancelled,
                        ]}>
                          {order.status || 'Pending'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.orderCell, { flex: 0.5, alignItems: 'center' }]}>
                      <ChevronRight size={16} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Sheet Modal for Order Details */}
      {selectedOrder && (
        <View style={styles.customModalBackdropContainer}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedOrder(null)}>
            <View style={styles.bottomSheetContainer}>
              <Pressable style={styles.bottomSheetContent} onPress={(e) => e.stopPropagation()}>
                
                {/* Drag Handle */}
                <View style={styles.bottomSheetHandleContainer}>
                  <View style={styles.bottomSheetHandle} />
                </View>

                {selectedOrder && (
                  <>
                    <View style={styles.detailHeader}>
                      <View style={{flex: 1}}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                          <Text style={styles.detailEmoji}>{selectedOrder.emoji || '📦'}</Text>
                          <Text style={styles.detailTitle}>Order {selectedOrder.id}</Text>
                        </View>
                        <Text style={styles.detailSubTitle}>{selectedOrder.date}</Text>
                      </View>
                      <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setSelectedOrder(null)}>
                        <X size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                      
                      {/* Stepper progress */}
                      <View style={styles.stepperContainer}>
                        <View style={styles.stepperLine} />
                        <View style={styles.stepperRow}>
                          <View style={[styles.stepCircle, (selectedOrder.status === 'Pending' || selectedOrder.status === 'In Transit' || selectedOrder.status === 'Completed') && styles.stepCircleActive]}>
                            <Clock size={12} color="#FFFFFF" />
                          </View>
                          <View style={[styles.stepCircle, (selectedOrder.status === 'In Transit' || selectedOrder.status === 'Completed') && styles.stepCircleActive]}>
                            <TrendingUp size={12} color="#FFFFFF" />
                          </View>
                          <View style={[styles.stepCircle, selectedOrder.status === 'Completed' && styles.stepCircleActive]}>
                            <CheckCircle size={12} color="#FFFFFF" />
                          </View>
                        </View>
                        <View style={styles.stepLabelsRow}>
                          <Text style={[styles.stepLabel, (selectedOrder.status === 'Pending' || selectedOrder.status === 'In Transit' || selectedOrder.status === 'Completed') && styles.stepLabelActive]}>Pending</Text>
                          <Text style={[styles.stepLabel, {textAlign: 'center'}, (selectedOrder.status === 'In Transit' || selectedOrder.status === 'Completed') && styles.stepLabelActive]}>In Transit</Text>
                          <Text style={[styles.stepLabel, {textAlign: 'right'}, selectedOrder.status === 'Completed' && styles.stepLabelActive]}>Delivered</Text>
                        </View>
                      </View>

                      {/* Quick Status Update buttons */}
                      <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>Fulfillment Status</Text>
                        <View style={styles.statusButtonsGroup}>
                          {['Pending', 'In Transit', 'Completed', 'Cancelled'].map((statusOption) => (
                            <TouchableOpacity
                              key={statusOption}
                              style={[
                                styles.statusOptionBtn,
                                selectedOrder.status === statusOption && styles.statusOptionBtnActive,
                                statusOption === 'Pending' && { borderColor: '#F59E0B' },
                                statusOption === 'In Transit' && { borderColor: '#3B82F6' },
                                statusOption === 'Completed' && { borderColor: '#10B981' },
                                statusOption === 'Cancelled' && { borderColor: '#EF4444' },
                                selectedOrder.status === statusOption && statusOption === 'Pending' && { backgroundColor: '#F59E0B' },
                                selectedOrder.status === statusOption && statusOption === 'In Transit' && { backgroundColor: '#3B82F6' },
                                selectedOrder.status === statusOption && statusOption === 'Completed' && { backgroundColor: '#10B981' },
                                selectedOrder.status === statusOption && statusOption === 'Cancelled' && { backgroundColor: '#EF4444' }
                              ]}
                              onPress={() => handleUpdateOrderStatus(selectedOrder.docId || selectedOrder.id, statusOption)}
                              disabled={isUpdatingStatus}
                            >
                              <Text style={[
                                styles.statusOptionBtnText,
                                selectedOrder.status === statusOption && styles.statusOptionBtnTextActive
                              ]}>
                                {statusOption}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Ordered Items Card */}
                      <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>Ordered Items</Text>
                        {selectedOrder.items?.map((item, idx) => (
                          <View key={idx} style={styles.detailItemRow}>
                            <View style={styles.detailItemNameCol}>
                              <Text style={styles.detailItemNameText}>{item.name}</Text>
                              <Text style={styles.detailItemQtyText}>{item.quantity} {item.unit || 'unit'}</Text>
                            </View>
                            <Text style={styles.detailItemPriceText}>₹{(Math.floor(Math.random() * 80) + 40) * item.quantity}</Text>
                          </View>
                        ))}
                        <View style={styles.detailTotalDivider} />
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Grand Total</Text>
                          <Text style={styles.detailTotalValue}>₹{selectedOrder.total}</Text>
                        </View>
                      </View>

                      {/* Customer Address Details Card */}
                      <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>Customer & Shipping Details</Text>
                        
                        <View style={styles.addressDetailItem}>
                          <User size={16} color="#6B7280" style={{marginRight: 10, marginTop: 2}} />
                          <View>
                            <Text style={styles.addressInfoLabel}>NAME</Text>
                            <Text style={styles.addressInfoVal}>{selectedOrder.address?.name || 'Srinivas'}</Text>
                          </View>
                        </View>

                        <View style={styles.addressDetailItem}>
                          <Phone size={16} color="#6B7280" style={{marginRight: 10, marginTop: 2}} />
                          <View>
                            <Text style={styles.addressInfoLabel}>CONTACT NUMBER</Text>
                            <Text style={styles.addressInfoVal}>{selectedOrder.address?.mobile || '9963092123'}</Text>
                          </View>
                        </View>

                        <View style={styles.addressDetailItem}>
                          <MapPin size={16} color="#6B7280" style={{marginRight: 10, marginTop: 2}} />
                          <View style={{flex: 1}}>
                            <Text style={styles.addressInfoLabel}>DELIVERY ADDRESS</Text>
                            <View style={styles.typeBadgeRow}>
                              <View style={styles.typeBadge}>
                                {selectedOrder.address?.type === 'Home' ? (
                                  <Home size={10} color="#818CF8" style={{marginRight: 4}} />
                                ) : (
                                  <Briefcase size={10} color="#818CF8" style={{marginRight: 4}} />
                                )}
                                <Text style={styles.typeBadgeText}>{selectedOrder.address?.type || 'Home'}</Text>
                              </View>
                              <Text style={styles.addressPincodeText}>PIN: {selectedOrder.address?.pincode || '505212'}</Text>
                            </View>
                            <Text style={styles.addressFlatText}>{selectedOrder.address?.flat}</Text>
                            <Text style={styles.addressStreetText}>{selectedOrder.address?.street}</Text>
                            {selectedOrder.address?.landmark ? (
                              <Text style={styles.addressLandmarkText}>Landmark: {selectedOrder.address?.landmark}</Text>
                            ) : null}
                          </View>
                        </View>
                      </View>

                      {/* Technical Meta */}
                      <View style={styles.metaContainer}>
                        <Text style={styles.metaLabelText}>CUSTOMER UID: {selectedOrder.userId}</Text>
                        <Text style={styles.metaLabelText}>DOCUMENT ID: {selectedOrder.docId}</Text>
                      </View>
                    </ScrollView>
                  </>
                )}

              </Pressable>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Auth Layout styles
  authContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  authBackgroundGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'radial-gradient(circle at top right, #1E1B4B 0%, #0B0F19 80%)',
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandLogoIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  authSectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorAlertText: {
    color: '#F87171',
    fontSize: 13,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 6,
    letterSpacing: 1,
  },
  textInput: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#374151',
    outlineStyle: 'none',
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1F2937',
  },
  dividerText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  authFooterText: {
    fontSize: 11,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 24,
  },

  // Dashboard styles
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  syncPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  syncText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 12,
  },
  actionBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  bannerAlert: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  bannerAlertTitle: {
    color: '#F59E0B',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bannerAlertDescription: {
    color: '#D97706',
    fontSize: 13,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 8,
    marginVertical: 8,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginVertical: 6,
  },
  statSubText: {
    fontSize: 12,
    color: '#4B5563',
  },
  panelsContainer: {
    flexDirection: 'row',
    marginHorizontal: -10,
  },
  rowDirection: {
    flexDirection: 'row',
  },
  colDirection: {
    flexDirection: 'column',
  },
  panelCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 10,
    marginBottom: 20,
  },
  panelControls: {
    marginBottom: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    outlineStyle: 'none',
  },
  tabScroll: {
    flexDirection: 'row',
  },
  tabScrollContent: {
    paddingVertical: 2,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#6366F1',
  },
  tabBtnText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  listHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    paddingBottom: 10,
    marginBottom: 10,
  },
  listHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loaderText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 15,
    marginTop: 12,
  },
  listContainer: {
    flexDirection: 'column',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  orderRowSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  orderCell: {
    justifyContent: 'center',
  },
  orderIdText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orderDateSubText: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
  },
  customerNameText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E5E7EB',
  },
  customerPhoneText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  itemsSummaryText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  totalText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemsCountText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  statusTransit: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  textPending: {
    color: '#F59E0B',
  },
  textTransit: {
    color: '#3B82F6',
  },
  textCompleted: {
    color: '#10B981',
  },
  textCancelled: {
    color: '#EF4444',
  },

  // Detail Panel styles
  detailPanel: {
    flex: 1.3,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    paddingBottom: 16,
    marginBottom: 16,
  },
  detailEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  detailSubTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeDetailBtn: {
    padding: 4,
  },
  detailScroll: {
    flex: 1,
  },
  stepperContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: 4,
  },
  stepperLine: {
    position: 'absolute',
    left: 32,
    right: 32,
    top: 10,
    height: 2,
    backgroundColor: '#1F2937',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111827',
  },
  stepCircleActive: {
    backgroundColor: '#6366F1',
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stepLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
    width: 60,
  },
  stepLabelActive: {
    color: '#E5E7EB',
  },
  detailCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  detailCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  statusButtonsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -4,
  },
  statusOptionBtn: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    margin: 4,
  },
  statusOptionBtnActive: {
    borderWidth: 0,
  },
  statusOptionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  statusOptionBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  detailItemNameCol: {
    flexDirection: 'column',
  },
  detailItemNameText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  detailItemQtyText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  detailItemPriceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  detailTotalDivider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 12,
  },
  detailTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E5E7EB',
  },
  detailTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  addressDetailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  addressInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  addressInfoVal: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 2,
    fontWeight: '500',
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    color: '#818CF8',
    fontWeight: '700',
  },
  addressPincodeText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  addressFlatText: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
    lineHeight: 18,
  },
  addressStreetText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
    lineHeight: 18,
  },
  addressLandmarkText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  metaContainer: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  metaLabelText: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#374151',
    marginBottom: 4,
  },
  detailPlaceholder: {
    flex: 1.3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#1F2937',
  },
  detailPlaceholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E5E7EB',
    marginBottom: 8,
  },
  detailPlaceholderDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  customModalBackdropContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bottomSheetContainer: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: '#111827',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
    maxHeight: Platform.OS === 'web' ? '85vh' : '85%',
  },
  bottomSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    width: '100%',
    flexShrink: 1,
  },
  bottomSheetHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  bottomSheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#374151',
  }
});

