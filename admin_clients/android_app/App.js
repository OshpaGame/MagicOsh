import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import io from 'socket.io-client';

// REPLACE WITH YOUR RENDER URL or Local IP for testing (e.g., http://192.168.1.5:3000)
const SERVER_URL = 'http://YOUR_RENDER_URL_HERE';

export default function App() {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [targetSocketId, setTargetSocketId] = useState(null);
    const [replyPlaceholder, setReplyPlaceholder] = useState('Selecciona un mensaje para responder...');

    const socketRef = useRef(null);

    useEffect(() => {
        // Connect to Server
        socketRef.current = io(SERVER_URL);

        socketRef.current.on('connect', () => {
            console.log('Android Admin Connected');
            socketRef.current.emit('identify', { type: 'admin_android' });
        });

        socketRef.current.on('new_message', (data) => {
            addMessage(data);
            // Auto-target latest
            setTargetSocketId(data.socketId);
            setReplyPlaceholder(`Responder a ${data.username}...`);
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, []);

    const addMessage = (data) => {
        setMessages(prev => [...prev, { ...data, id: Date.now().toString() }]);
    };

    const handleSend = () => {
        if (!inputText.trim() || !targetSocketId) return;

        const replyData = {
            targetSocketId: targetSocketId,
            message: inputText.trim()
        };

        socketRef.current.emit('admin_reply', replyData);

        // Add my reply to list
        addMessage({
            username: 'Yo (Admin)',
            text: inputText.trim(),
            timestamp: new Date().toISOString(),
            isMe: true
        });

        setInputText('');
    };

    const selectMessage = (msg) => {
        if (!msg.isMe) {
            setTargetSocketId(msg.socketId);
            setReplyPlaceholder(`Responder a ${msg.username}...`);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity onPress={() => selectMessage(item)} activeOpacity={0.8}>
            <View style={[
                styles.messageCard,
                item.isMe ? styles.myMessage : styles.incomingMessage
            ]}>
                <View style={styles.msgHeader}>
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.time}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                <Text style={styles.msgText}>{item.text}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>MagicOsh Admin</Text>
                <View style={styles.onlineBadge} />
            </View>

            <FlatList
                data={messages}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                style={styles.list}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.inputContainer}
            >
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={replyPlaceholder}
                    placeholderTextColor="#666"
                />
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                    <Text style={styles.sendBtnText}>→</Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050510',
    },
    header: {
        padding: 20,
        backgroundColor: '#0a0a1a',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(176, 0, 255, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 30 // Safe area top
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'System'
    },
    onlineBadge: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#00ff9d',
        shadowColor: '#00ff9d',
        shadowRadius: 5,
        shadowOpacity: 0.8
    },
    list: {
        flex: 1,
    },
    listContent: {
        padding: 15,
    },
    messageCard: {
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
    },
    incomingMessage: {
        backgroundColor: 'rgba(0, 243, 255, 0.05)',
        borderColor: 'rgba(0, 243, 255, 0.2)',
        borderLeftWidth: 4,
        borderLeftColor: '#00f3ff'
    },
    myMessage: {
        backgroundColor: 'rgba(176, 0, 255, 0.05)',
        borderColor: 'rgba(176, 0, 255, 0.2)',
        borderLeftWidth: 4,
        borderLeftColor: '#b000ff',
        alignSelf: 'flex-end',
        width: '90%'
    },
    msgHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5
    },
    username: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    },
    time: {
        color: '#888',
        fontSize: 10
    },
    msgText: {
        color: '#e0e0e0',
        fontSize: 16
    },
    inputContainer: {
        padding: 15,
        backgroundColor: '#0a0a1a',
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)'
    },
    input: {
        flex: 1,
        backgroundColor: '#050510',
        color: '#fff',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        marginRight: 10
    },
    sendBtn: {
        backgroundColor: '#b000ff',
        width: 45,
        height: 45,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#b000ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    sendBtnText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold'
    }
});
