import re

def migrate():
    path = r'c:\Users\DELL\Desktop\Apps\LR-Ride\mobile\src\student\pages\WalletPage.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if "PremiumBottomSheet" not in content:
        content = content.replace("import GlassCard from '../components/premium/GlassCard'", "import GlassCard from '../components/premium/GlassCard'\nimport PremiumBottomSheet from '../components/premium/PremiumBottomSheet'")

    # Migration pairs: (Regex Pattern for Modal, Replacement)
    modals = [
        (
            r'<Modal\s+visible=\{receiveModalVisible\}\s+animationType="fade"\s+transparent\s+onRequestClose=\{([^}]+)\}\s*>\s*<View style=\{styles\.modalBackdrop\}>\s*<View style=\{styles\.modalCard\}>\s*(.*?)\s*</View>\s*</View>\s*</Modal>',
            r'<PremiumBottomSheet visible={receiveModalVisible} onClose={\1}>\n          \2\n      </PremiumBottomSheet>'
        ),
        (
            r'<Modal\s+visible=\{fundModalVisible\}\s+animationType="fade"\s+transparent\s+onRequestClose=\{([^}]+)\}\s*>\s*<View style=\{styles\.modalBackdrop\}>\s*<View style=\{styles\.modalCard\}>\s*(.*?)\s*</View>\s*</View>\s*</Modal>',
            r'<PremiumBottomSheet visible={fundModalVisible} onClose={\1}>\n          \2\n      </PremiumBottomSheet>'
        ),
        (
            r'<Modal\s+visible=\{transferIdModalVisible\}\s+animationType="fade"\s+transparent\s+onRequestClose=\{([^}]+)\}\s*>\s*<View style=\{styles\.modalBackdrop\}>\s*<View style=\{styles\.modalCard\}>\s*(.*?)\s*</View>\s*</View>\s*<LoadingOverlay visible=\{recipientLookupLoading\} />\s*</Modal>',
            r'<PremiumBottomSheet visible={transferIdModalVisible} onClose={\1}>\n          \2\n        <LoadingOverlay visible={recipientLookupLoading} />\n      </PremiumBottomSheet>'
        ),
        (
            r'<Modal\s+visible=\{!!recipient\}\s+animationType="fade"\s+transparent\s+onRequestClose=\{([^}]+)\}\s*>\s*<View style=\{styles\.modalBackdrop\}>\s*<View style=\{styles\.modalCard\}>\s*(.*?)\s*</View>\s*</View>\s*</Modal>',
            r'<PremiumBottomSheet visible={!!recipient} onClose={\1} snapPoints={["50%", "75%"]}>\n          \2\n      </PremiumBottomSheet>'
        ),
        (
            r'<Modal\s+visible=\{transferConfirmVisible\}\s+animationType="fade"\s+transparent\s+onRequestClose=\{([^}]+)\}\s*>\s*<View style=\{styles\.modalBackdrop\}>\s*<View style=\{styles\.modalCard\}>\s*(.*?)\s*</View>\s*</View>\s*<LoadingOverlay visible=\{transferLoading \|\| transferPinLoading\} />\s*</Modal>',
            r'<PremiumBottomSheet visible={transferConfirmVisible} onClose={\1} snapPoints={["75%", "90%"]}>\n          \2\n        <LoadingOverlay visible={transferLoading || transferPinLoading} />\n      </PremiumBottomSheet>'
        ),
        (
            r'<Modal visible=\{gatewayModalVisible\} animationType="slide" transparent onRequestClose=\{([^}]+)\}>\s*<View style=\{pinStyles\.backdrop\}>\s*<View style=\{pinStyles\.card\}>\s*(.*?)\s*</View>\s*</View>\s*</Modal>',
            r'<PremiumBottomSheet visible={gatewayModalVisible} onClose={\1} snapPoints={["40%"]}>\n          \2\n      </PremiumBottomSheet>'
        ),
        (
            r'<Modal\s+visible=\{!!selectedTransaction\}\s+animationType="slide"\s+transparent\s+onRequestClose=\{([^}]+)\}\s*>\s*<TouchableOpacity style=\{styles\.modalBackdropReceipt\}[^>]*>\s*<TouchableOpacity style=\{styles\.receiptCard\}[^>]*>\s*(.*?)\s*</TouchableOpacity>\s*</TouchableOpacity>\s*</Modal>',
            r'<PremiumBottomSheet visible={!!selectedTransaction} onClose={\1} snapPoints={["60%", "85%"]} useScrollView>\n          \2\n      </PremiumBottomSheet>'
        ),
        (
            r'<Modal\s+visible=\{transactionsModalVisible\}\s+animationType="slide"\s+onRequestClose=\{([^}]+)\}\s*>\s*<SafeAreaView style=\{styles\.page\}>\s*(.*?)\s*</SafeAreaView>\s*</Modal>',
            r'<PremiumBottomSheet visible={transactionsModalVisible} onClose={\1} snapPoints={["90%"]} useScrollView>\n          \2\n      </PremiumBottomSheet>'
        )
    ]

    for pattern, replacement in modals:
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Modals migrated!")

if __name__ == "__main__":
    migrate()
